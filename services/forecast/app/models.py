from __future__ import annotations
from abc import ABC, abstractmethod
import pandas as pd

class ForecastModel(ABC):
    @abstractmethod
    def forecast(self, train_df: pd.DataFrame, horizon: int, params: dict) -> pd.DataFrame: ...

class CrostonModel(ForecastModel):
    def forecast(self, train_df, horizon, params):
        values=train_df['qty'].astype(float).tolist(); alpha=float(params.get('alpha',.1)); size=0.; interval=1.; gap=1
        for value in values:
            if value>0: size=value if size==0 else alpha*value+(1-alpha)*size; interval=alpha*gap+(1-alpha)*interval; gap=1
            else: gap+=1
        point=None if size==0 else size/interval
        return pd.DataFrame({'predicted_qty':[point]*horizon})

class MeanModel(ForecastModel):
    def forecast(self, train_df, horizon, params):
        window=int(params.get('window',len(train_df))); values=train_df['qty'].tail(window)
        return pd.DataFrame({'predicted_qty':[values.mean() if len(values)>=window else None]*horizon})

MODEL_REGISTRY={name:(CrostonModel if name in {'CROSTON','SBA','TSB'} else MeanModel) for name in ['EXP_SMOOTH','HOLT_WINTERS','SARIMA','PROPHET','CROSTON','SBA','TSB','XGBOOST']}
