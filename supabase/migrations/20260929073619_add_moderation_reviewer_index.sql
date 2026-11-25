create index moderation_reports_reviewer_idx
  on public.moderation_reports(reviewed_by_user_id)
  where reviewed_by_user_id is not null;
