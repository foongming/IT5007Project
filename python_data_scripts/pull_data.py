from records import get_records 
from scrape import get_listings 

if __name__ == "__main__":
    get_records()
    get_listings()
    print("Data successfully scraped and stored locally as csv files.")
