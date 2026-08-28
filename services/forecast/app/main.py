from __future__ import annotations
import os, uuid, traceback
from datetime import date
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client
from .models import MODEL_REGISTRY

app=FastAPI(title='SCM Forecast Service')
class RunRequest(BaseModel): run_id:str|None=None; horizon:int; models:list[dict]; train_rows:list[dict]; demand_types:dict[str,str]
def client(): return create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_ROLE_KEY'])
@app.get('/health')
def health(): return {'status':'ok'}
@app.get('/models')
def models(): return {'models':list(MODEL_REGISTRY)}
@app.post('/forecast/run')
def run(request:RunRequest):
    db=client(); run_id=request.run_id or str(uuid.uuid4())
    try:
        rows=pd.DataFrame(request.train_rows)
        for config in request.models:
            model_id=config['model_id']; cls=MODEL_REGISTRY.get(model_id)
            if not cls: continue
            for item_id, train in rows.groupby('item_id'):
                if request.demand_types.get(str(item_id)) not in config['applicable_demand_type']: continue
                result=cls().forecast(train.sort_values('period_start'),request.horizon,config.get('parameters',{}))
                for offset, prediction in enumerate(result['predicted_qty'].tolist(),1):
                    if prediction is None or pd.isna(prediction): continue
                    db.schema('core').table('forecast_result').insert({'run_id':run_id,'model_id':model_id,'item_id':str(item_id),'period':str(pd.Timestamp(train['period_start'].max())+pd.DateOffset(months=offset))[:10],'model_version':config['version'],'predicted_qty':float(prediction),'p50':float(prediction),'p80':None,'p90':None,'basis':{'engine':'PYTHON','parameters':config.get('parameters',{})}}).execute()
        return {'run_id':run_id,'status':'SUCCESS'}
    except Exception as exc:
        db.schema('core').table('forecast_run').update({'status':'FAILED','message':str(exc)[:1000]}).eq('run_id',run_id).execute()
        raise HTTPException(500,detail='FORECAST_SERVICE_FAILED') from exc
@app.post('/backtest/run')
def backtest(): return {'status':'delegate_to_core_run_backtest'}
