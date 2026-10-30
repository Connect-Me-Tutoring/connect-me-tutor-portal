# PostHog deletion audit schema

Every successfully deleted row produces a `destructive_activity` event. PostHog delivery is
best-effort and is not a permanent database audit log.

## Common audit metadata

All events include `action`, `resource_type`, `resource_id`, `source`, `reason`, `actor_type`,
`actor_user_id`, `actor_profile_id`, `actor_role`, `related_resource_type`,
`related_resource_ids_json`, `deleted_object_json`, and `timestamp`.

The requested resource-specific data is deliberately limited to the fields below.

## Profile deletions

- `profile_name`
- `profile_email`

## Enrollment deletions

- `enrollment_date` (the enrollment `start_date`)
- `enrollment_duration`
- `student_name`
- `student_email`
- `tutor_name`
- `tutor_email`

## Pairing deletions

- `student_name`
- `student_email`
- `tutor_name`
- `tutor_email`

`deleted_object_json` contains only the corresponding fields above plus the deleted row ID used by
the common audit metadata. Token, secret, password, and API-key fields remain redacted globally.

Session and event deletions continue to use the common properties and their existing redacted JSON
snapshot.
