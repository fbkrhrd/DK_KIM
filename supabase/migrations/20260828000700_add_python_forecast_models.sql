-- STEP 8: Python model registry entries share STEP 6 forecast_result/run contracts.
insert into core.model_config(model_id,model_name,family,engine,version,applicable_demand_type,parameters,description) values
('EXP_SMOOTH','Exponential Smoothing','EXPONENTIAL_SMOOTHING','PYTHON','1.0.0',array['SMOOTH','ERRATIC'],'{}','statsmodels exponential smoothing'),
('HOLT_WINTERS','Holt-Winters','HOLT_WINTERS','PYTHON','1.0.0',array['SMOOTH','ERRATIC'],'{}','seasonal trend model'),
('SARIMA','SARIMA','SARIMA','PYTHON','1.0.0',array['SMOOTH','ERRATIC'],'{}','seasonal ARIMA'),
('PROPHET','Prophet','PROPHET','PYTHON','1.0.0',array['SMOOTH','ERRATIC'],'{}','Prophet service model'),
('CROSTON','Croston','CROSTON','PYTHON','1.0.0',array['INTERMITTENT','LUMPY'],'{"alpha":0.1}','intermittent demand'),
('SBA','SBA','SBA','PYTHON','1.0.0',array['INTERMITTENT','LUMPY'],'{"alpha":0.1}','bias-adjusted Croston'),
('TSB','TSB','TSB','PYTHON','1.0.0',array['INTERMITTENT','LUMPY'],'{"alpha":0.1,"beta":0.1}','TSB intermittent demand'),
('XGBOOST','XGBoost','XGBOOST','PYTHON','1.0.0',array['SMOOTH','ERRATIC'],'{}','gradient boosted model') on conflict(model_id) do nothing;
