## Grace AI - Pre-Launch UAT Checklist

### Auth and Onboarding
[ ] Sign up with a new email and land on dashboard  
[ ] Create organization and verify org appears in sidebar  
[ ] Invite team member and verify shared org data  
[ ] Non-admin cannot buy phone numbers (hidden or Admin only state)  

### Agent Management
[ ] Create agent with name, prompt, voice, and language  
[ ] Save call flow and verify it persists on refresh  
[ ] Upload PDF to knowledge base and verify it appears in list  
[ ] Upload TXT/CSV file and verify ingestion  
[ ] Delete KB document and verify removal  
[ ] Assign phone number to agent  

### Inbound Call Flow
[ ] Call assigned Twilio number and verify greeting  
[ ] Verify STT transcription quality  
[ ] Verify LLM response quality and TTS playback  
[ ] Trigger appointment booking flow  
[ ] Trigger human transfer flow  
[ ] End call and verify call appears with transcript, summary, sentiment  

### Outbound Campaign
[ ] Import/create contacts and verify in Customers tab  
[ ] Create campaign with agent + contacts  
[ ] Launch campaign and verify calls are queued  
[ ] Track campaign progress in Jobs tab  

### Live Monitoring
[ ] Active calls visible with realtime transcript updates  
[ ] Email/SMS events appear in live feeds  
[ ] SSE reconnect works after network interruption  

### Billing and Plans
[ ] Free plan blocks over-limit actions with upgrade modal  
[ ] Upgrade flow opens Stripe checkout  
[ ] Stripe payment updates plan and limits  
[ ] Manage Billing opens Stripe portal  
[ ] Invoice history table shows recent invoices and PDF links  

### Settings and Appearance
[ ] Theme modes (Light, Dark, System) all work  
[ ] No hydration/theme flicker errors on refresh  
[ ] Integrations status renders correctly  

### Performance
[ ] Voice turn latency logs are present in backend logs  
[ ] Dashboard initial load under expected threshold  
[ ] Calls page remains responsive with high record count  

### Final Readiness
[ ] `cd apps/api && pytest --tb=short`  
[ ] `cd apps/web && npm run test`  
[ ] `cd apps/web && npx tsc --noEmit`  
[ ] `cd apps/api && alembic upgrade head`  
[ ] `/health` returns db/redis connected  
