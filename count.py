import pandas as pd

# Path to your dataset
csv_path = "data/diabetes_dataset.csv"   

# Read the CSV
df = pd.read_csv(csv_path)

# Basic sanity check
if "diabetes" not in df.columns:
    raise ValueError("Column 'diabetes' not found in the dataset.")

# Count diabetic (1) and non-diabetic (0)
diabetic_count = (df["diabetes"] == 1).sum()
non_diabetic_count = (df["diabetes"] == 0).sum()

total = len(df)

print(f"Total records: {total}")
print(f"Diabetic (diabetes = 1): {diabetic_count}")
print(f"Non-diabetic (diabetes = 0): {non_diabetic_count}")
