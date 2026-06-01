CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public."Profiles" (
    user_id, 
    email, 
    role,
    first_name, 
    last_name, 
    age,
    grade,
    gender,
    start_date,
    availability,
    parent_name,
    parent_email,
    phone_number,
    timezone,
    subjects_of_interest,
    status,
    student_number,
    languages_spoken
  )
  values (
    new.id, 
    new.email,
    new.raw_user_meta_data ->> 'role',
    new.raw_user_meta_data ->> 'first_name', 
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'age',
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'gender',
    (new.raw_user_meta_data ->> 'start_date')::DATE,
  (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'availability')),
    new.raw_user_meta_data ->> 'parent_name',
    new.raw_user_meta_data ->> 'parent_email',
    new.raw_user_meta_data ->> 'phone_number',
    new.raw_user_meta_data ->> 'timezone',
    (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'subjects_of_interest')),
    new.raw_user_meta_data ->> 'status',
    new.raw_user_meta_data ->> 'student_number',
      (SELECT array_agg(value) FROM jsonb_array_elements(new.raw_user_meta_data -> 'languages_spoken'))
  );

  if lower(coalesce(new.raw_user_meta_data ->> 'role', '')) in ('student', 'tutor') then
    with latest_request as (
      select pr.id, pr.in_queue
      from public.pairing_requests pr
      where pr.user_id = (
        select p.id
        from public."Profiles" p
        where p.user_id = new.id
        order by p.created_at desc
        limit 1
      )
      order by pr.created_at desc
      limit 1
    )
    update public.pairing_requests
    set
      in_queue = true,
      status = 'pending'
    where id in (
      select lr.id
      from latest_request lr
      where lr.in_queue = false
    );

    if not exists (
      select 1
      from public.pairing_requests pr
      where pr.user_id = (
        select p.id
        from public."Profiles" p
        where p.user_id = new.id
        order by p.created_at desc
        limit 1
      )
        and pr.in_queue is distinct from false
    ) then
      insert into public.pairing_requests (
        user_id,
        type,
        status,
        in_queue,
        notes
      )
      values (
        (
          select p.id
          from public."Profiles" p
          where p.user_id = new.id
          order by p.created_at desc
          limit 1
        ),
        lower(new.raw_user_meta_data ->> 'role'),
        'pending',
        true,
        'Auto-enqueued on account creation'
      );
    end if;
  end if;
  return new;
end;
$function$
