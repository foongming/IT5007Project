## This project was done for IT5007 in AY2023/2024 Sem 2
### Data files and env files have been removed in this clean version of the repo
## Background, Motivation and Primary User Story

Following property prices and property launches is a national obsession in Singapore.  
Many young Singaporeans aspire to own a home, and with ever-rising property prices, many look to property as both a home and an investment, expecting that the value of a home will appreciate with time.  

This has led many Singaporeans to pour over past transaction values to determine  
a) the best locations to buy a home in and  
b) the appropriate value to transact at.  

The government even enables this by transparently having resale flat prices available on data.gov.sg, the Government's one-stop portal for publicly available datasets from various public agencies.  

However, what buyers really need is two sets of data: historical data analysis and the available listings at the time.  

AS A potential HDB buyer,  
I WANT TO view the past HDB transaction data along with the available homes for sale in that area,  
SO THAT I can determine if there are available homes in the specified area that I want to consider purchasing  

## Project Questions

Q1. Is the problem relevant a year/2-years/5-years/10-years from now?

Yes. Housing will always be a necessity and the desire to “strike a good deal” is universal human behaviour. Our project is called “Hit the Jackpot”, reflecting the desire in the heart of Singaporeans who believe in striking it rich through the property market.  

Q2. What is the challenging aspect of the problem? Have others not thought of the problem or is the solution difficult to come up with?

To buy a home, a buyer would have to complete two steps:  
- Analyse past data to determine areas where homes have historically appreciated in asset value (Demand side)  
- Match homes available on the market to results from the transaction data analysis (Supply side)  

To date, there is no solution on the market that addresses both steps comprehensively, in near-real time, and together (in one view)  

Many blogs and financial influencers such as seedly, investment moats, budget babe and stacked homes cover pieces of part 1 in a sporadic fashion, such that their analysis can quickly become outdated or carry a narrow focus. While supply side information providers such as property guru or 99.co which primarily function as an online classified ad section, do not integrate past transaction comprehensive past transaction data from the government into their listings.  

Given that none of the actors in this space have a long term interest in maintaining a comprehensive and up to date database matching demand and supply, and that this use case only crops up a few times across the life span of the expected users (home buyers), it is unsurprising that this pain point is not solved comprehensively.  

Home buyers can fulfil their needs manually with excel and internet trawling.  
Content creators in the personal finance space or property space address this pain point infrequently such that manual analysis where needed is sufficient.  

Q3. What is your approach to solving it? What is novel about the solution?

Data aggregation:  
Our proposed solution is to make both pieces of data available in a single view, such that a user can complete both steps at the same time. Our proposed solution is also easily extensible - To increase coverage of listings, we can easily scale by adding more listing partners (classifieds and real estate agencies). We can also easily scale to new markets once data sets are acquired.  

The aggregator business model has been well proven by companies such as skyscanner. Profitability can be achieved with scale through sale of ads or promoted listings.  

Q4. How will you prevent people from copying your solution? (which you patent it?)

For this PoC, we believe that there are low barriers to entry. Hence the selection of this identified opportunity for this course project.  

## Competitive Analysis

However, the solution is gated against the providers of the datasets for this solution. The government is highly unlikely to enter this space as a market player, keeping to its role of controlling housing prices through policy. The property listing sites by nature are unable to incorporate data from their competitors (e.g. propertyguru cannot scrape listings from 99.co and show them on the propertyguru website) and hence will always have a smaller data set than our solution does.  

Post PoC, many routes to building moats against competitors exist. Including but not limited to building differentiating capabilities such as advancing the data analysis made available on the webapp. The first work on this includes our implementation of rebasing historical data trends for both transactions and the Singapore Straits Times Index to analyse the growth of the housing market against the broader market across time.  

## References

1. [Seedly Blog on HDB Resale Flats](https://blog.seedly.sg/hdb-resale-flats-price-high/)
2. [Investment Moats on Visualizing Affordability](https://investmentmoats.com/uncategorized/visualizing-the-affordability-of-4-room-hdb-flats-and-rental-growth/)
3. [SG Budget Babe on Choosing the Right BTO Flat](https://sgbudgetbabe.com/choosing-the-right-bto-flat/)
4. [Stacked Homes Editorial on Affordable HDB Flats](https://stackedhomes.com/editorial/where-to-find-the-cheapest-4-room-resale-hdb-flats-in-2024-from-350000/#gs.5b96pp)

## Data

1. Historical transaction data is open data provided by [data.gov.sg](https://beta.data.gov.sg/collections/189/view)
2. As this webapp is focused on the buyer persona, only transactions for purchasing of homes are in scope. Rental data availability and analysis is out of scope.
3. Listings data is extracted from [EdgeProp](https://edgeprop.sg/) using our python script `scrape.py` as none of the big listing classifieds in Singapore (e.g., propertyguru) have open APIs to call for listing data.
5. Historical index fund performance provided by [AlphaVantage](https://www.alphavantage.co) via live API call. In our project, historical prices are indexed against an ETF based on the Straits Times Index (STI) to match the Singapore market. This API is open to all with a 20 calls/day limit

## Stack and Libraries

### Database
- Mongo, MongoAtlas for cloud hosting
- Python for pulling data from sources
  - main libraries used: geopandas, pandas, requests

### Front End
- React
- Bootstrap5
- Charting library: [Recharts](https://recharts.org/)
- Icons: [Feather](https://feathericons.com/)

### API
- express.js
- graphql
- Historical Price for STI equivalent Index: [Alphavantage](https://www.alphavantage.co/)
- Map API: [Mapbox](https://www.mapbox.com/)

## Architecture

![Architecture](https://github.com/IT5007-2320/course-project-team5/assets/31128994/bee9c11a-75a3-4258-96bc-0036efaa8b0c)

## Frontend Repo Structure

![Frontend Structure](https://github.com/IT5007-2320/course-project-team5/assets/31128994/789e1179-532d-4dfa-bdba-11477471ca82)

## List of Frontend Features

1. Map interactivity 
2. Search map by
   - POI
   - Address
   - Postal code
3. Map pins showing past transaction locations and details
4. Map pins showing current listings locations and details
5. Filter capability for historical transactions by
   - Towns available in the dataset
   - FlatTypes available in the dataset
   - Price per square foot range
   - Floor area range
6. Table of historical transactions
7. Table of currently available listings
8. Chart of indexed historical transactions in area rebased and charted against indexed STI
9. Loading animation 

## List of Backend Features

### Graphql Endpoints
1. getDistinctFlatTypes:
   - Returns enum list to filters based on Flat Types available in the database.
2. getDistinctTowns:
   - Returns enum list to filters based on Towns available in the database.
3. getListing:
   - Returns a specified listing’s data.
4. getListings:
   - Returns an array of listings based on the map bounded area and filter parameters passed.
5. getRecord:
   - Returns specified record’s data.
6. getRecords:
   - Returns an array of listings based on the map bounded area and filter parameters passed.
7. getRecordsAveragePrice:
   - Returns an array of average price per based on map bounded area and filter parameters passed.

### Database integration
- MongoDB Cloud Atlas
- MongoClient

### Security
- CORS enabled

### Graphql documentation
- Apollo

## UI Design Approach

We have opted for a Single Page Application (SPA) with no page scrolling as this maximised usability and engagement with the webapp.

In user testing, the users instinctively use the map as the main controller, citing that they expected a similar experience to google maps and airbnb, where the main controller was the map.

![UI Design](https://github.com/IT5007-2320/course-project-team5/assets/31128994/1f7fd77f-61ae-430a-8cc7-5a91ccd31b3d)

## User Flow + Logic Walkthrough

### UX Flow 1 - Exploration

As a home buyer  
I want to explore the price trends and home availability across Singapore  
So that I can gain an understanding of the price ranges to contend with

![Exploration UX](https://github.com/IT5007-2320/course-project-team5/assets/31128994/67f0946c-4258-44d1-a218-6f004c76c31a)

### User Flow 2 - Targeted Search

As a home buyer with a preferred location in mind  
I want to go straight to that location  
So that I can focus my analysis on my area of choice

![Targeted Search](https://github.com/IT5007-2320/course-project-team5/assets/31128994/3d0bc0c1-2ef5-4ab8-8953-4b969dc52b58)

### User Flow 3 - Targeted Search with Budget or Size Limits

As a home buyer with preferred location(s) and specific home sizes and/or budgets in mind  
I want to analyse the past transactions and available listings in the area with those parameters  
So that I can focus my analysis on data within my location, size, and budget parameters

![Targeted Search with Budget or Size Limits](https://github.com/IT5007-2320/course-project-team5/assets/31128994/3af5fc3a-cb35-4961-84e1-537a4f23b3f5)

## Installation Guide
### WARNING: Docker is not supported 

### frontend
- from the `frontend` folder, `npm install` and `npm start`

### backend
- from the `server` folder, `npm install` and `npm start`
- note that connection to mongo is already included and no further work to connect to mongo is necessary

### python data scripts [optional]
- **Note: if you decide to do this, it will take upwards of 30mins because of the data size**
- we used python to pull data from our sources listed above
- this is not required because the data is alread in mongo Atlas
- to manually pull data (csv files) to the local environment set up a python virtual environment
  - `python -m venv .venv`
  - `source .venv/bin/activate # for mac/linux`
- install dependencies
  - `pip install -r requrements.txt` 
- change directory to `python_data_scripts/`
- run data pulls
  - `python pull_data.py`
- this will run and pull data from the sources, clean it and render it into .csv files
- the .csv files must manually be added to mongo Atlas, because for production purposes, the supplied webapp token only has read access

## Credits

ChatGPT3.5, ChatGPT4, and Microsoft copilot were used during development for auto-complete and debugging.
