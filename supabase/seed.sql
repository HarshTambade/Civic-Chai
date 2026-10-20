-- Synthetic data for local demos only. No real officer, contact, law or SLA data
-- is seeded. Replace demo localities and contacts with authority-verified rows.

insert into public.jurisdictions(level,name,pin,source_version,is_verified)
values
  ('pin','Demo PIN 401208','401208','demo-v1',false),
  ('pin','Demo PIN 401209','401209','demo-v1',false),
  ('pin','Demo PIN 401210','401210','demo-v1',false),
  ('pin','Demo PIN 401211','401211','demo-v1',false)
on conflict (level,name,pin) do nothing;

insert into public.issues (
  document_id,title,description,original_text,normalized_text,category,department,pin,locality,status,priority,
  priority_score,priority_severity,priority_factors,trust,trust_factors,ai_confidence,language,source_channel,model_version,
  chai_heat,supporters,reports,comments,days_unresolved,officer,hub,is_demo,created_at
)
values
  ('CC-DEMO-401208-001','DEMO: Streetlight outage on Station Road','Synthetic sample: a streetlight outage report awaiting jurisdiction confirmation.','Synthetic sample: a streetlight outage report awaiting jurisdiction confirmation.','Demo report: streetlight outage; verify locality and responsible route before use.','Public Lighting','Municipal Public Lighting','401208','Station Road (demo)','In Progress','High',69,70,'{"severity":70,"community_support":0,"corroboration":0,"persistence":40,"geographic_impact":35,"evidence":20,"sla":10}',58,'{"evidence":35,"location_consistency":75,"corroboration":0,"report_consistency":75,"anomaly":0}',82,'English','web','civicchai-rules-v1',0,0,1,0,8,'Assignment pending','No verified authority hub',true,now()-interval '8 days'),
  ('CC-DEMO-401209-001','DEMO: Waste collection delay','Synthetic sample: a waste collection report awaiting jurisdiction confirmation.','Synthetic sample: a waste collection report awaiting jurisdiction confirmation.','Demo report: waste collection delay; verify locality and responsible route before use.','Sanitation','Solid Waste Management','401209','Demo locality A','Assigned','Moderate',47,48,'{"severity":48,"community_support":0,"corroboration":0,"persistence":20,"geographic_impact":20,"evidence":20,"sla":10}',52,'{"evidence":35,"location_consistency":75,"corroboration":0,"report_consistency":75,"anomaly":0}',77,'English','web','civicchai-rules-v1',0,0,1,0,5,'Assignment pending','No verified authority hub',true,now()-interval '5 days'),
  ('CC-DEMO-401208-002','DEMO: Road damage near school boundary','Synthetic sample: a road damage report awaiting jurisdiction confirmation.','Synthetic sample: a road damage report awaiting jurisdiction confirmation.','Demo report: road damage; verify locality and responsible route before use.','Roads & Potholes','PWD — Roads Division','401208','Demo locality B','Filed','High',66,72,'{"severity":72,"community_support":0,"corroboration":0,"persistence":15,"geographic_impact":50,"evidence":20,"sla":10}',55,'{"evidence":35,"location_consistency":75,"corroboration":0,"report_consistency":75,"anomaly":0}',79,'English','pwa','civicchai-rules-v1',0,0,1,0,1,'Assignment pending','No verified authority hub',true,now()-interval '1 day'),
  ('CC-DEMO-401210-001','DEMO: Water supply disruption','Synthetic sample: a water supply report awaiting jurisdiction confirmation.','Synthetic sample: a water supply report awaiting jurisdiction confirmation.','Demo report: water supply disruption; verify locality and responsible route before use.','Water Supply','Water Works Department','401210','Demo locality C','Filed','Moderate',54,58,'{"severity":58,"community_support":0,"corroboration":0,"persistence":10,"geographic_impact":30,"evidence":20,"sla":10}',50,'{"evidence":35,"location_consistency":75,"corroboration":0,"report_consistency":75,"anomaly":0}',74,'English','web','civicchai-rules-v1',0,0,1,0,0,'Assignment pending','No verified authority hub',true,now()-interval '6 hours')
on conflict (document_id) do update set
  title=excluded.title,description=excluded.description,original_text=excluded.original_text,normalized_text=excluded.normalized_text,
  category=excluded.category,department=excluded.department,pin=excluded.pin,locality=excluded.locality,status=excluded.status,
  priority=excluded.priority,priority_score=excluded.priority_score,priority_severity=excluded.priority_severity,
  priority_factors=excluded.priority_factors,trust=excluded.trust,trust_factors=excluded.trust_factors,
  ai_confidence=excluded.ai_confidence,language=excluded.language,source_channel=excluded.source_channel,model_version=excluded.model_version,is_demo=true;

insert into public.issue_reports(issue_id,source_channel,original_text,language,priority_severity,trust_score,trust_factors,model_version)
select i.id,i.source_channel,i.original_text,i.language,i.priority_severity,i.trust,i.trust_factors,i.model_version
from public.issues i
where i.document_id like 'CC-DEMO-%'
  and not exists (select 1 from public.issue_reports r where r.issue_id=i.id and r.original_text=i.original_text);
