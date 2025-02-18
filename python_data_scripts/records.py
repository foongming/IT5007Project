import requests
import pandas as pd
import os
from typing import Union
from tqdm import tqdm,trange
import geopandas as gp
tqdm.pandas()

DATA_DIR = './data' 

def get_gov_api_data(endpoint: str, v2: bool=False, params: Union[dict, None]=None) -> requests.models.Response:
    """Get data from sg gov data API.


    """
    if v2:
        base_url = "https://api-production.data.gov.sg/v2/public/api/"
    else:
        base_url = "https://data.gov.sg/api/action/"
    return requests.get(base_url + endpoint, params)


def get_gov_collections() -> requests.models.Response:
    """Get all available collections from sg gov data API.
    """
    endpoint = "collections"
    return get_gov_api_data(endpoint, v2=True)


def get_gov_collection_metadata(collection_id: int) -> requests.models.Response:
    """Get collection metadata from sg gov data API.

    :param collection_id: id of the collection to get metadata from
    """
    endpoint = "collections/" + str(collection_id) + "/metadata"
    return get_gov_api_data(endpoint, v2=True)


def get_dataset_ids(collection_id: int) -> list[int]:
    """Get dataset ids from the collection id.

    :param collection_id: id of the collection to get dataset ids from
    """
    res = get_gov_collection_metadata(collection_id)
    return res.json()["data"]["collectionMetadata"]["childDatasets"]


def get_dataset_data(dataset_id: int) -> pd.DataFrame:
    """Get dataset data from sg gov data API.

    :param dataset_id: id of the dataset to get data from
    """
    endpoint = "datastore_search"
    offset = 0
    limit = 14500
    dfs = []
    res = get_gov_api_data(endpoint, v2=False, params={"resource_id": dataset_id, 'offset': 0, 'limit': limit})
    total = res.json()['result']['total']
    iterator = trange(0, total+1, limit)
    for _ in iterator:
        params = {"resource_id": dataset_id, 'offset': offset, 'limit': limit}
        res = get_gov_api_data(endpoint, v2=False, params=params)
        total = res.json()['result']['total']
        df = pd.DataFrame(res.json()['result']['records'])
        if df.empty:
            iterator.close()
            break
        dfs.append(df)
        offset = res.json()['result']['_links']['next']\
            .split('?')[-1]\
            .split('&')[-2]\
            .split('=')[-1]
        offset = int(offset)
    return pd.concat(dfs)


def get_data(collection_id) -> pd.DataFrame:
    """Get all data from collection id from sg gov data.

    :param collection_id: id of the collection to get data from
    """
    datasets = get_dataset_ids(collection_id)

           
    dfs = []
    print(f'fetching {collection_id} data from API')
    for d in datasets:
        dfs.append(get_dataset_data(d))
    return pd.concat(dfs)

def get_resale_data() -> pd.DataFrame:
    """Get resale data from the API.
    """
    collection_id = 189
    print(f'fetching resale ({collection_id}) data...')
    return get_data(collection_id)


def clean_resale(df: pd.DataFrame) -> pd.DataFrame:
    """Clean the resale data.

    :param df: pandas dataframe of resale data
    """
    df[['year', 'month']] = df['month'].str.split('-').to_list()
    df[['year', 'month', 'lease_commence_date']] = df[['year', 'month', 'lease_commence_date']].astype(int)
    df['remaining_lease'] = 99 - (df['year'] - df['lease_commence_date']) # assuming only years
    df['floor_area_sqm'] = df['floor_area_sqm'].astype(float)
    df['resale_price'] = df['resale_price'].astype(float)
    df['town'] = df['town'].str.upper()
    df['Sqft'] = df['floor_area_sqm'] * 10.7639
    df['Psf'] = df.resale_price / df.Sqft

    df['Sqft'] = df['Sqft'].round().astype(int)
    df['Psf'] = df['Psf'].round().astype(int)

    df.resale_price.astype(float)
    df.flat_type = df.flat_type.replace('MULTI-GENERATION', 'MULTI GENERATION')
    df.flat_model = df.flat_model.str.upper()
    df['date'] = df['year'].astype(str) + '-' + df['month'].astype(str)
    df.date = pd.to_datetime(df.date, format='%Y-%m')
    df = df[df['year']>=2000]
    df = df.dropna()


    df = df[~df.isna().any(axis=1)]
    df = df.drop(columns=['_id'])
    df['coord_key'] = df['block'] + ' ' + df['street_name']
    return df


def get_coords(addresses) -> pd.DataFrame:
    """Get the coordinates for a list of addresses.
    
    :param key: addresses
    """
    base_url = 'https://www.onemap.gov.sg/api/common/elastic/search?'
    out = []
    for address in tqdm(addresses):
        row = {}
        params = {
                'searchVal': address,
                'returnGeom': 'Y',
                'getAddrDetails': 'Y',
                }
        row['coord_key'] = address
        res = requests.get(base_url, params=params)
        if res.status_code != 200 or not res.json().get('results'):
            row['lat'] = None
            row['lng'] = None
            row['postal'] = None
        else:
            d = res.json().get('results')
            row['lat'] = d[0].get('LATITUDE')
            row['lng'] = d[0].get('LONGITUDE')
            row['postal'] = d[0].get('POSTAL')
        out.append(row)
    return pd.DataFrame(out)


def write_file(df: pd.DataFrame) -> None:
    """Write the cleaned resale data to a csv file.
    """
    df.to_csv(os.path.join(DATA_DIR, 'resale.csv'), index=False)
    return None


def merge_towns(df):
    if 'town' in df.columns:
        df = df.drop(columns='town')
    towns = gp.GeoDataFrame.from_file('towns.json')
    geo_df = gp.GeoDataFrame(df, geometry=gp.points_from_xy(df.lng, df.lat))
    geo_df.crs = towns.crs
    df_town_merge = gp.sjoin(geo_df, towns, predicate='within').drop(columns=['geometry', 'index_right'])
    return df_town_merge

def clean_postals(df):
    df['postal'] = df[df['postal'] != 'NIL'].dropna()['postal'].astype(int)
    df = df.dropna(subset=['postal'])
    df['postal'] = df['postal'].astype(int)

    df['address'] = (
            df['block']
            + ' '
            + df['street_name']
            + ' SINGAPORE '
            + df['postal'].astype(str)
            )
    df['address'] = df['address'].str.replace('.0', '')
    df = df.drop(columns=['block'])
    return df


def get_records():
    """Main function to run the entire pipeline.
    """
    df = get_resale_data()
    df = clean_resale(df)
    coord_keys = get_coords(df['coord_key'].drop_duplicates().tolist())

    df = df.merge(coord_keys, on='coord_key').drop(columns='coord_key')
    df = clean_postals(df)
    df = merge_towns(df)
    write_file(df)
    return df


if __name__ == "__main__":
    get_records()
