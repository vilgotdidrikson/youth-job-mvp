# Production backup and first restore

Both backup modes create three SQL dumps (roles, schema and data) and
copy the objects from every production Supabase Storage bucket. They
verify each archive's checksum before adding `COMPLETE`. Production
only receives read operations.

## Take a manual backup on an existing computer

The first backup can run on an access-controlled Linux computer or Windows
with WSL. This mode requires Supabase CLI 3, Docker for the CLI, rclone,
Python 3 and OpenSSL with CMS support. Use an encrypted work disk for the temporary SQL and
object files. On WSL, that includes the disk storing the Linux distribution.
Keep the finished copy on separate storage if available so a single disk
failure does not take out every copy.

Export the production database URL and production Storage variables from
the tables below in a private terminal session. Supply the values without
saving credentials in shell history or a file in the repository. Point
`MNW_BACKUP_LOCAL_DIR` at an existing private backup directory and set
`MNW_BACKUP_ENCRYPTION_CERT` to the path of a trusted PEM certificate
containing an RSA public key. Keep its password-protected private key
separately from the backup drive. The backup computer needs only the
certificate. If a backup key does not exist, generate one on the private
recovery machine and copy only `backup-public.pem` to the backup computer.

```sh
umask 077
openssl req -x509 -newkey rsa:3072 -sha256 -days 365 -subj '/CN=MatchnWork backup' \
  -keyout backup-private.pem -out backup-public.pem
```

OpenSSL prompts for a password to protect the private key. Record a
reminder to replace the certificate before it expires and retain old keys
needed for any retained backups.

```sh
bash scripts/backup-production.sh local
```

The completed directory contains `snapshot.tar.gz.cms`, `SHA256SUMS` and
`COMPLETE`. The local mode uses no S3 destination and no GitHub runner.
To start a restore, work inside the completed directory and decrypt to an
encrypted, private work directory.

```sh
sha256sum --check SHA256SUMS
openssl cms -decrypt -binary -inform DER -in snapshot.tar.gz.cms \
  -recip backup-public.pem -inkey /path/to/backup-private.pem \
  -out /path/to/private/restore/snapshot.tar.gz
```

Continue with the isolated database and Storage recovery checks below.

## Set up the optional nightly workflow

The Production backup workflow runs from `master` and is opt-in.

1. Prepare a private S3-compatible bucket in the EU with encryption at rest
   and public access disabled. Scope the backup key to this bucket. For
   Cloudflare R2 EU use the EU jurisdiction, the jurisdiction-specific S3
   endpoint and S3 region `auto`. Record the processor and agree a retention
   period before enabling automatic runs. Preserve the pre-migration copy
   through release verification.
2. Register a dedicated Linux runner with the label `matchnwork-backup-eu`
   on an access-controlled EU host with an encrypted work disk. Install
   Docker, Supabase CLI 3, rclone and Python 3. Keep Docker images and backup
   tools updated. Limit runner access to the private repository and review
   workflows that can target it. For the first run, check that the runner can
   reach the production Postgres session pooler, Supabase Storage and the
   backup endpoint.
3. Create the GitHub environment `production-backup` and restrict deployments
   to `master`. Set the following environment variables and secrets in GitHub.
   Do not put their secret values in the repository or in support messages.

| Environment variable | Value |
| --- | --- |
| `MNW_SUPABASE_S3_ENDPOINT` | S3 endpoint shown in the production Supabase Storage settings |
| `MNW_BACKUP_S3_ENDPOINT` | Private backup provider's HTTPS S3 endpoint |
| `MNW_BACKUP_S3_REGION` | Backup provider's S3 region |
| `MNW_BACKUP_S3_BUCKET` | Private backup bucket name |

| Environment secret | Value |
| --- | --- |
| `MNW_BACKUP_DATABASE_URL` | Production Postgres session-pooler URI on port 5432, with the URL-encoded database password and `sslmode=require` |
| `MNW_SUPABASE_S3_ACCESS_KEY_ID` | Production Supabase Storage S3 access key ID |
| `MNW_SUPABASE_S3_SECRET_ACCESS_KEY` | Production Supabase Storage S3 secret access key |
| `MNW_BACKUP_S3_ACCESS_KEY_ID` | Access key ID scoped to the backup bucket |
| `MNW_BACKUP_S3_SECRET_ACCESS_KEY` | Secret access key scoped to the backup bucket |

The Supabase Storage key bypasses RLS. Use a dedicated key for the backup
runner and revoke it if the runner is retired. Logs report which step failed
without printing the underlying output, which can contain object names or
connection details.

## Run and verify

1. Leave the repository variable `MNW_BACKUP_ENABLED` unset. When the workflow
   is on `master`, start **Production backup** manually from GitHub Actions.
   Check the run result and the presence of an archive, `SHA256SUMS` and
   `COMPLETE` in the same run prefix.
2. Rehearse recovery with a separate private Supabase project or a local
   Supabase instance on an access-controlled EU host. Keep email, webhooks
   and jobs disabled while production data is present. Download the archive
   and checksum securely. Verify the checksum before extracting
   to a private directory. For a manual backup, verify and decrypt it using
   the commands above. Follow the
   [Supabase CLI restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
   for the database roles, schemas and data.
3. Verify Storage recovery separately. Recreate each bucket and its settings
   as needed, restore the object bytes via the Storage API, and compare
   object counts and lengths against the archive. Reconcile restored Storage
   metadata with the upload procedure in the isolated restore target, including
   any existing object rows. Check public image access and private CV access
   with the intended identities. Verify the waitlist data and important
   database policies and permissions. Record results without copying personal
   data into the run log. Remove the isolated data when done.
4. Enable regular backups by setting the repository variable
   `MNW_BACKUP_ENABLED` to `true`. The backup runs daily at 01:23 UTC. The
   06:37 UTC job fails if it cannot find a verified backup from the last
   30 hours. Confirm that the on-call owner sees failed workflow runs.
   The freshness check uses the same GitHub scheduler and EU runner.

The database and Storage copies are made sequentially. For the
pre-migration backup, pause writes while the copy runs if the waitlist or
Storage is receiving updates. The archive checksum detects corruption in
the uploaded copy. The restore rehearsal verifies that the contents can
be used for recovery.


## Rehearse the production migration (L10)

On 2026-11-25, DevStaging passed all 16 checks in
`scripts/check-launch-schema.sql`. Production passed two. Production had
28 public tables and neither `pg_cron` nor `pg_net`; DevStaging had
43 public and 27 private tables and both extensions. Check which workers
and schedules the release actually requires before enabling jobs or
adding secrets to the release environment.

The three production history entries below match the SQL from `master`
after normalizing whitespace and statement delimiters. The files are
absent from `dev` and their names use different timestamps.

| Production history version | File prefix on `master` | Migration |
| --- | --- | --- |
| `20261102093036` | `20261102092942` | `prelaunch_waitlist` |
| `20261116103603` | `20261116103319` | `fix_prelaunch_shared_network_limits` |
| `20261117074445` | `20261117074240` | `restore_prelaunch_signup_ip_limit` |

1. Restore the backup to an isolated target, including bucket objects.
   Capture a baseline of the restored schema, migration ledger, record
   counts, public/private bucket settings and waitlist behavior. Check
   for test isolation before running any app code on this target.
2. Use the recorded versions above when bringing the three matching
   files into the release migration history. Keep the already-applied
   production entries and avoid replaying those statements. Compare
   the rest of the candidate SQL to the restored schema and the verified
   DevStaging schema before deciding what to apply. Production's sparse
   ledger does not account for all the schema already there. DevStaging also
   has timestamp mismatches and omissions, so neither ledger alone can
   define the production migration list.
3. Apply the reviewed migration sequence to the restored target. Run
   `scripts/check-launch-schema.sql` and the waitlist, auth, access-control
   and private Storage checks. Check the waitlist row count and existing
   unsubscribe behavior before and after. Record the tested commands,
   schema outcomes, and any environment prerequisites. If the first
   attempt fails, restore the same baseline before retrying the sequence.
4. Test the release code against that isolated target. A simulated
   `master`/`dev` merge has conflicts in `AGENTS.md`, the job generation and
   voice endpoints, root layout and page, job map, and mobile navigation.
   Integrate the full app deliberately. Preserve the waitlist's privileged
   authorization and existing unsubscribe routes through cutover. Keep
   app deployment and database recovery steps distinct.

Use the rehearsed sequence on production only after the restore and release
checks pass. Keep an immediate pre-migration copy through deployment
verification.
