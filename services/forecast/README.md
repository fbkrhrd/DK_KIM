# Forecast service

Run with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Set `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`; never expose this key to Next.js. The service reads training rows supplied by the server and writes the existing `core.forecast_result` contract.
