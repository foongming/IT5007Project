import time
import json

import requests
import pandas as pd
import geopandas as gp
from tqdm import tqdm
import os
from typing import Union

DATA_DIR="./data"
PAGES=250
EMPTY_PAGE_LIMIT=5

def scrape_edgeprop_page(res: list, page: int) -> list:
    """Scrape page from edgeprop

    :param res: list to store results
    :param page: page number to scrape
    :return: list of results
    """
    r = requests.get(rf'https://www.edgeprop.sg/hdb-for-sale?page={page}')
    main_entity_index = r.text.find('"mainEntity"')
    publisher_index = r.text.find('"publisher"') - 1
    if main_entity_index == -1 or publisher_index == -1:
        return res
    listingdict = eval('{' + r.text[main_entity_index:publisher_index] + '}')
    item_list = listingdict.get('mainEntity')
    if item_list:
        elements = item_list.get('itemListElement')
        count = len(elements)

        for i in range(count):
            additional_property = elements[i].get('additionalProperty')
            propertytype = 0
            pricepsf = 0
            if additional_property:
                for j in range(len(additional_property)):

                    if additional_property[j]['name'] == 'Property Type':
                        propertytype = additional_property[j]['value']
                    if additional_property[j]['name'] == 'Price per Square Foot':
                        pricepsf = additional_property[j]['value']
                        pricepsf = int(pricepsf
                                       .replace('S$','')
                                       .replace(',','')
                                       .replace(' ', '')
                                       .replace('psf', '')
                                       )
           
            r2 = requests.get(rf"https://www.onemap.gov.sg/api/common/elastic/search?searchVal={elements[i]['name'].replace(' ','%20')}&returnGeom=Y&getAddrDetails=Y&pageNum=1")
            if r2.status_code == 200:
                try:
                    postal = json.loads(r2.text)['results'][0]['POSTAL']
                    lat = json.loads(r2.text)['results'][0]['LATITUDE']
                    lon = json.loads(r2.text)['results'][0]['LONGITUDE']
                except Exception:
                    print("Invalid location data structure")
                    postal = lat = lon= 'null'
            else:
                postal = lat = lon= 'null'
        
            res.append({
                'Address': elements[i]['name'],
                'HDBType': propertytype,
                'Bathrooms': elements[i]['itemOffered']['numberOfBathroomsTotal'],
                'UtilityRooms': elements[i]['itemOffered']['numberOfRooms'],
                'Sqft': elements[i]['itemOffered']['floorSize']['value'], #sq ft
                'Psf': pricepsf,
                'Price': elements[i]['price'],
                'Postal': postal,
                'Lat': lat,
                'Lon': lon,
                'URL': elements[i]['url']
            })
    return res

def scrape_edgeprop(n: int=1000, empty_pages: int=0, empty_pages_limit: int=5, interval: int=1) -> pd.DataFrame:
    """Scrape edgeprop for n pages

    :param n: number of pages to scrape
    :param empty_pages: number of empty pages
    :param empty_pages_limit: limit of empty pages
    :param interval: interval between requests
    :return: dataframe of results
    """
    tmplst = []
    progress = 0
    with tqdm(total=n, ascii=True, desc='scraping data ') as pbar:
        for page in range(n):
            if empty_pages == empty_pages_limit:
                print(n, progress)
                pbar.update(n-progress)
                print('empty pages limit reached')
                break
            scraped = scrape_edgeprop_page(tmplst, page)
            if not scraped:
                pbar.update(1)
                empty_pages += 1
                continue
            time.sleep(interval)
            pbar.update(1)
            progress += 1 
    df = pd.DataFrame(tmplst)
    return df

def clean_edgeprop_data(df: pd.DataFrame) -> pd.DataFrame:
    """Clean edgeprop data
    
    :param df: dataframe to clean
    :return: cleaned dataframe
    """
    flat_type = {
            'EA (Exec Apartment)': 'EXECUTIVE',
            '4A': '4 ROOM',
            '3A': '3 ROOM',
            '4I (Improved)': '4 ROOM',
            '5I': '5 ROOM',
            '2A': '2 ROOM',
            'EM (Exec Maisonette)': 'EXECUTIVE',
            '3NG': '3 ROOM',
            '3NG (Modified)': '3 ROOM',
            '3I (Improved)': '3 ROOM',
            '4NG (New Generation)': '4 ROOM',
            '3STD (Standard)': '3 ROOM',
            '4STD (Standard)': '4 ROOM',
            '5A': '5 ROOM',
            '4S (Simplified)': '4 ROOM',
            '5S': '5 ROOM',
            'Premium Apartment': 'OTHERS',
            '3S (Simplified)': '3 ROOM',
            '3I (Modified)': '3 ROOM',
            '2I (Improved)': '2 ROOM',
            '3NG (New Generation)': '3 ROOM',
            'Jumbo': 'OTHERS',
            'MG (Multi-Generation)': 'MULTI GENERATION',
            '2S (Standard)': '2 ROOM',
            '2-Room': '2 ROOM',
            '3A (MODIFIED)': '3 ROOM',
            'Terrace': 'TERRACE',
            '5PA': '5 ROOM',
            }
    df['Sqft'] = df['Sqft'].str.replace(',', '').str.replace(' ', '')
    df['Sqft'] = df['Sqft'].apply(lambda x: int('0') if not x else int(x))
    df['flat_type'] = df['HDBType'].map(flat_type).fillna('OTHERS')

    df['postal'] = df[df['postal'] != 'NIL'].dropna()['postal'].astype(int)
    df = df.dropna(subset=['postal'])
    df['postal'] = df['postal'].astype(int)

    return df

def merge_towns(df: pd.DataFrame) -> pd.DataFrame:
    """Merge towns to dataframe
    
    :param df: dataframe to merge
    :return: dataframe with towns merged
    """
    towns = gp.GeoDataFrame.from_file('towns.json').to_crs('EPSG:4326')
    geo_df = gp.GeoDataFrame(df, geometry=gp.points_from_xy(df.Lon, df.Lat))
    geo_df.crs = towns.crs
    df_town_merge = gp.sjoin(geo_df, towns, predicate='within').drop(columns=['geometry', 'index_right'])
    return df_town_merge

def get_listings(n: int=1000) -> Union[pd.DataFrame, None]:
    """Get listings from edgeprop
    :param n: number of pages to scrape
    :return: dataframe of listings
    """
    try:
        df = scrape_edgeprop(n, empty_pages_limit=EMPTY_PAGE_LIMIT)
        df = clean_edgeprop_data(df).dropna(subset=['Lat', 'Lon'])
        df = merge_towns(df).drop_duplicates()
        df.to_csv(os.path.join(DATA_DIR, 'edgeprop.csv'), index=False)
        return df
    except Exception as e:
        print(e)
        print('ensure the following is available: towns.json, access to edgeprop.sg, pandas, geopandas, requests')
        exit(1)

if __name__ == '__main__':
    get_listings(n=PAGES)
