#!/usr/bin/env bash
set -euo pipefail
umask 077

mode=${1:-backup}
project=iarnopkuoqumictgnqin

case "$mode" in
  backup|check|local) ;;
  *) echo 'Expected mode backup, check or local.' >&2; exit 1 ;;
esac

if [[ "$mode" != local ]]; then
  : "${MNW_BACKUP_S3_ENDPOINT:?Missing backup endpoint}"
  : "${MNW_BACKUP_S3_REGION:?Missing backup region}"
  : "${MNW_BACKUP_S3_BUCKET:?Missing backup bucket}"
  : "${MNW_BACKUP_S3_ACCESS_KEY_ID:?Missing backup access key}"
  : "${MNW_BACKUP_S3_SECRET_ACCESS_KEY:?Missing backup secret key}"

  case "$MNW_BACKUP_S3_ENDPOINT" in
    https://*) ;;
    *) echo 'The backup endpoint must use HTTPS.' >&2; exit 1 ;;
  esac

  if [[ ! "$MNW_BACKUP_S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
    echo 'Invalid backup bucket name.' >&2
    exit 1
  fi

  export RCLONE_CONFIG_MNW_BACKUP_TYPE=s3
  export RCLONE_CONFIG_MNW_BACKUP_PROVIDER=Other
  export RCLONE_CONFIG_MNW_BACKUP_ENDPOINT="$MNW_BACKUP_S3_ENDPOINT"
  export RCLONE_CONFIG_MNW_BACKUP_REGION="$MNW_BACKUP_S3_REGION"
  export RCLONE_CONFIG_MNW_BACKUP_ACCESS_KEY_ID="$MNW_BACKUP_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_MNW_BACKUP_SECRET_ACCESS_KEY="$MNW_BACKUP_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_MNW_BACKUP_NO_CHECK_BUCKET=true
  destination="mnw_backup:${MNW_BACKUP_S3_BUCKET}/matchnwork-production"
fi

if [[ "$mode" == check ]]; then
  if ! listing=$(rclone lsf --recursive --files-only --include '*/COMPLETE' "$destination" 2>/dev/null); then
    echo 'Cannot list completed production backups.' >&2
    exit 1
  fi

  cutoff=$(date -u -d '30 hours ago' +%Y%m%dT%H%M%SZ)
  while IFS= read -r path; do
    if [[ "$path" =~ ^([0-9]{8}T[0-9]{6}Z)-[a-zA-Z0-9-]+/COMPLETE$ && "${BASH_REMATCH[1]}" > "$cutoff" ]]; then
      echo 'A verified production backup exists from the last 30 hours.'
      exit 0
    fi
  done <<< "$listing"

  echo 'No verified production backup found from the last 30 hours.' >&2
  exit 1
fi

if [[ "$mode" == local ]]; then
  : "${MNW_BACKUP_LOCAL_DIR:?Missing local backup directory}"
  : "${MNW_BACKUP_ENCRYPTION_CERT:?Missing backup encryption certificate}"
  if [[ ! -d "$MNW_BACKUP_LOCAL_DIR" || ! -w "$MNW_BACKUP_LOCAL_DIR" ]]; then
    echo 'The local backup directory must exist and be writable.' >&2
    exit 1
  fi
  if ! openssl x509 -in "$MNW_BACKUP_ENCRYPTION_CERT" -checkend 0 -noout >/dev/null 2>&1; then
    echo 'A valid backup encryption certificate is required.' >&2
    exit 1
  fi
fi

: "${MNW_BACKUP_DATABASE_URL:?Missing production database URL}"
: "${MNW_SUPABASE_S3_ENDPOINT:?Missing production Storage endpoint}"
: "${MNW_SUPABASE_S3_ACCESS_KEY_ID:?Missing production Storage access key}"
: "${MNW_SUPABASE_S3_SECRET_ACCESS_KEY:?Missing production Storage secret key}"

# Refuse connections to a different project or to Supavisor's transaction mode.
python3 - "$project" "$mode" <<'PY'
import os
import sys
from urllib.parse import parse_qs, urlsplit

project = sys.argv[1]
database = urlsplit(os.environ["MNW_BACKUP_DATABASE_URL"])
direct = database.hostname == f"db.{project}.supabase.co" and database.username == "postgres"
pooler = (
    (database.hostname or "").endswith(".pooler.supabase.com")
    and database.username == f"postgres.{project}"
)
if not (
    database.scheme in {"postgres", "postgresql"}
    and database.port == 5432
    and database.path == "/postgres"
    and parse_qs(database.query).get("sslmode") in (["require"], ["verify-ca"], ["verify-full"])
    and (direct or pooler)
):
    sys.exit("Expected the production Postgres connection on port 5432 with TLS.")

source = urlsplit(os.environ["MNW_SUPABASE_S3_ENDPOINT"])
if (
    source.scheme != "https"
    or source.netloc not in {f"{project}.supabase.co", f"{project}.storage.supabase.co"}
    or source.path.rstrip("/") != "/storage/v1/s3"
    or source.query
    or source.fragment
):
    sys.exit("Expected the Supabase production Storage S3 endpoint.")
if sys.argv[2] == "backup":
    target = urlsplit(os.environ["MNW_BACKUP_S3_ENDPOINT"])
    if not target.hostname or target.hostname.endswith(".supabase.co") or target.username or target.query or target.fragment:
        sys.exit("Expected a separate S3 backup provider.")
PY

export RCLONE_CONFIG_MNW_SOURCE_TYPE=s3
export RCLONE_CONFIG_MNW_SOURCE_PROVIDER=Other
export RCLONE_CONFIG_MNW_SOURCE_ENDPOINT="$MNW_SUPABASE_S3_ENDPOINT"
export RCLONE_CONFIG_MNW_SOURCE_REGION=eu-west-1
export RCLONE_CONFIG_MNW_SOURCE_ACCESS_KEY_ID="$MNW_SUPABASE_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_MNW_SOURCE_SECRET_ACCESS_KEY="$MNW_SUPABASE_S3_SECRET_ACCESS_KEY"

work=$(mktemp -d)
pending=
trap 'rm -rf -- "$work"; if [[ -n "$pending" ]]; then rm -rf -- "$pending"; fi' EXIT
mkdir -p "$work/snapshot/database" "$work/snapshot/storage"

# Supabase and rclone diagnostics can include sensitive connection or object details.
backup_step() {
  local description=$1
  shift
  if ! "$@" 2>/dev/null; then
    printf 'Backup failed during %s.\n' "$description" >&2
    exit 1
  fi
}

database="$work/snapshot/database"
backup_step 'database roles' supabase db dump --remote="$MNW_BACKUP_DATABASE_URL" -f "$database/roles.sql" --role-only >/dev/null
backup_step 'database schema' supabase db dump --remote="$MNW_BACKUP_DATABASE_URL" -f "$database/schema.sql" >/dev/null
backup_step 'database data' supabase db dump --remote="$MNW_BACKUP_DATABASE_URL" -f "$database/data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes >/dev/null

for dump in roles schema data; do
  if [[ ! -s "$database/$dump.sql" ]]; then
    printf 'Missing or empty database dump for %s.\n' "$dump" >&2
    exit 1
  fi
done
echo 'Database dumps created.'

backup_step 'listing Storage buckets' rclone lsf --dirs-only mnw_source: > "$work/buckets"
for required in job-images youth-documents; do
  if ! grep -Fxq "$required/" "$work/buckets"; then
    echo 'A required production Storage bucket is missing.' >&2
    exit 1
  fi
done

while IFS= read -r entry; do
  bucket=${entry%/}
  if [[ ! "$bucket" =~ ^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$ ]]; then
    echo 'An unexpected Storage bucket name needs review.' >&2
    exit 1
  fi
  local_bucket="$work/snapshot/storage/$bucket"
  mkdir "$local_bucket"
  backup_step 'copying Storage objects' rclone copy "mnw_source:$bucket" "$local_bucket" >/dev/null
  backup_step 'checking Storage object sizes' rclone check --size-only "mnw_source:$bucket" "$local_bucket" >/dev/null
done < "$work/buckets"
echo 'Storage objects copied and checked.'

run="$(date -u +%Y%m%dT%H%M%SZ)-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${work##*.}"
if [[ "$mode" == local ]]; then
  pending=$(mktemp -d -- "$MNW_BACKUP_LOCAL_DIR/.snapshot.XXXXXXXX")
  backup_step 'packing database and Storage' tar -C "$work/snapshot" -czf - . |
    backup_step 'encrypting the archive' openssl cms -encrypt -binary -stream -aes-256-gcm -outform DER \
      -recip "$MNW_BACKUP_ENCRYPTION_CERT" -keyopt rsa_padding_mode:oaep -keyopt rsa_oaep_md:sha256 \
      -out "$pending/snapshot.tar.gz.cms"
  (
    cd "$pending"
    sha256sum snapshot.tar.gz.cms > SHA256SUMS
    sha256sum --check SHA256SUMS
    date -u +%FT%TZ > COMPLETE
  )
  mv -T -- "$pending" "$MNW_BACKUP_LOCAL_DIR/$run"
  pending=
  printf 'Encrypted production backup saved (%s).\n' "$run"
  exit 0
fi

archive="$destination/$run"
backup_step 'creating the archive' tar -C "$work/snapshot" -czf "$work/snapshot.tar.gz" .
(cd "$work" && sha256sum snapshot.tar.gz > SHA256SUMS)
backup_step 'uploading the archive' rclone copyto "$work/snapshot.tar.gz" "$archive/snapshot.tar.gz" >/dev/null
backup_step 'uploading the checksum' rclone copyto "$work/SHA256SUMS" "$archive/SHA256SUMS" >/dev/null

expected=$(cut -d ' ' -f 1 "$work/SHA256SUMS")
backup_step 'reading back the archive' rclone cat "$archive/snapshot.tar.gz" | sha256sum > "$work/remote-hash"
actual=$(cut -d ' ' -f 1 "$work/remote-hash")
backup_step 'reading back the checksum' rclone cat "$archive/SHA256SUMS" > "$work/remote-checksum"
if [[ "$actual" != "$expected" ]] || ! cmp -s "$work/SHA256SUMS" "$work/remote-checksum"; then
  echo 'Uploaded backup did not pass the checksum verification.' >&2
  exit 1
fi

date -u +%FT%TZ > "$work/COMPLETE"
backup_step 'marking the backup complete' rclone copyto "$work/COMPLETE" "$archive/COMPLETE" >/dev/null
printf 'Production backup uploaded and verified (%s).\n' "$run"
