update users set email='user'||id||'@demo.invalid', sub=null;
delete from push_subscriptions;
delete from users_sessions;
update form_submissions_submission_data set value = 'applicant' || _parent_id || '@demo.invalid' where field = 'email';
update form_submissions_submission_data set value = '+20 100 000 0000' where field = 'phone';
update form_submissions_submission_data set value = 'Sample Applicant ' || _parent_id where field in ('name', 'full_name');
