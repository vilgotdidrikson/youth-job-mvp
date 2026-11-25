# Production backup and first restore

The Production backup workflow runs from `master`. It creates three SQL
dumps (roles, schema and data) and copies the objects from every production
Supabase Storage bucket. It verifies the uploaded archive and its checksum
before adding `COMPLETE`. Production only receives read operations. Incomplete
uploads are ignored by the freshness check.

## Set up the backup environment

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
   and checksum securely. Run `sha256sum --check SHA256SUMS` before extracting
   to a private directory. Follow the
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
