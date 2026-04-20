import kagglehub
import os
import pandas as pd

print("Downloading dataset...")
path = kagglehub.dataset_download("asaniczka/amazon-products-dataset-2023-1-4m-products")
print("Path to dataset files:", path)
for f in os.listdir(path):
    print(" -", f)

    if f.endswith('.csv'):
        df = pd.read_csv(os.path.join(path, f), nrows=5)
        print("\n--- Dataframe Info ---")
        print(df.info())
        print("\n--- First Record ---")
        print(df.iloc[0].to_dict())
