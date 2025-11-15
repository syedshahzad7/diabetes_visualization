import pandas as pd
df = pd.read_csv('data/diabetes_dataset.csv')
print(df['smoking_history'].unique())