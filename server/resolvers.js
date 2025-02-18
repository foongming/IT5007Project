import db from './db/db.js';
import { ObjectId } from 'mongodb';
import { GraphQLScalarType } from 'graphql';

const GraphQLDate = new GraphQLScalarType({
  name: 'GraphQLDate',
  description: 'A Date() type in GraphQL as a scalar',
  serialize(value) {
    return value.toISOString();
  }, parseValue(value) {
    const dateValue = new Date(value);
    return isNaN(dateValue) ? undefined : dateValue;
  },
  parseLiteral(ast) {
    if (ast.kind == Kind.STRING) {
      const value = new Date(ast.value);
      return isNaN(value) ? undefined : value;
    }
  },
});

/**
 * Creates a range object to query MongoDB. This function processes an input object containing range keys
 * and converts them into a MongoDB-compatible query object with `$gte` and `$lte` operators.
 * Optionally handles date conversion if the ranges represent dates.
 * 
 * @param {Object} params - Object with keys representing range variables. Each key's value is used as the range value.
 * @param {boolean} [is_date=false] - Boolean flag indicating if the provided range values should be treated as dates.
 * @returns {Object} - MongoDB query object formatted with `$gte` and `$lte` conditions.
 */
function createRange(params, is_date=false) {
  const rngVars = Object.keys(params)
  var arg = {}
  rngVars.forEach((rngVar) => {
    if (params[rngVar] !== null || params[rngVar] !== undefined) {
        if (is_date) {
          arg['$'.concat(rngVar)] = new Date(params[rngVar]);
        } else {
          arg['$'.concat(rngVar)] = params[rngVar];
        }
    }
  })
  return arg
}

/**
 * Creates a range object to query MongoDB. This function processes an input object containing range keys
 * and converts them into a MongoDB-compatible query object with `$gte` and `$lte` operators.
 * Optionally handles date conversion if the ranges represent dates.
 * 
 * @param {Object} params - Object with keys representing range variables. Each key's value is used as the range value.
 * @param {boolean} [is_date=false] - Boolean flag indicating if the provided range values should be treated as dates.
 * @returns {Object} - MongoDB query object formatted with `$gte` and `$lte` conditions.
 */
function updateRangeArgs(args, rangeMap) {
  for (let [k, v] of Object.entries(rangeMap)) {
    let rng;
    if (k in args) {
      if (v == 'date') {
        rng = createRange(args[k], is_date=true)
      } else {
        rng = createRange(args[k])
      }
      Object.keys(rng).length > 0 ? args[v] = rng : null
      delete args[k]
    }
  }
  return args
}

/**
 * Transforms specified keys in the `args` object based on the `inListMap`. This function converts each key in the `args`
 * object to a new MongoDB query format based on conditions. If an array under a key has more than one item, it is converted
 * to use the `$in` operator. If there is exactly one item, it replaces the key with just that item. Original keys are removed
 * after transformation.
 * 
 * @param {Object} args - The original arguments object containing keys that may need to be transformed into MongoDB query formats.
 * @param {Object} inListMap - A mapping object where each key is an existing key in `args` that needs transformation,
 *                             and the value is the new key under which the transformed query or value should be stored.
 * @returns {Object} - The modified arguments object with updated keys and MongoDB query formats. Original keys specified in `inListMap` are removed.
 */
function updateInListArgs(args, inListMap) {
  for (let [k, v] of Object.entries(inListMap)) {
    if (k in args) {
      if (args[k].length > 1) {
        args[v] = { "$in": args[k] }
      } else if (args[k].length == 1) {
        args[v] = args[k][0]
      }
      delete args[k]
    }
  }
  return args
}

/**
 * Retrieves a specific record from the 'cleanedResale' MongoDB collection based on its `_id`.
 * This asynchronous function queries the database using the MongoDB ObjectId of the record.
 *
 * @param {Object} _ - This parameter is not used in the function but is included to match function signature requirements.
 * @param {Object} args - An object containing the `id` of the record to retrieve. The `id` should be a string representation of a MongoDB ObjectId.
 * @returns {Promise<Object>} - A promise that resolves to the MongoDB document matching the `_id`, or `null` if no document is found.
 */
async function getRecord(_, args) {
  const collection = db.collection("cleanedResale");
  const id = args.id;
  let query = { _id: new ObjectId(id) };
  return await collection.findOne(query);
}


/**
 * Asynchronously retrieves records from the 'cleanedResale' MongoDB collection based on the specified search criteria.
 * The function modifies the search arguments to match specific MongoDB query formats using `updateRangeArgs` and `updateInListArgs`.
 * It supports filtering by various ranges (year, month, longitude, latitude, date, square footage, price per square foot)
 * and lists (towns, flat types). Optionally, a limit can be specified to restrict the number of records returned.
 * 
 * @param {Object} _ - Unused parameter, typically present to adhere to a specific function signature requirement.
 * @param {Object} param1 - An object containing a nested `args` object with search criteria and optional limit.
 * @param {Object} context - The context object, potentially used for accessing additional configuration or services.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of records matching the criteria. If a 'limit' is specified,
 *                                     the result is sorted by 'date' in descending order and limited to the specified number of records.
 * 
 * @example
 * // Call getRecords with specific search criteria
 * getRecords(null, { args: { yearRange: [2010, 2020], towns: ['Town1', 'Town2'], limit: 5 } }, {})
 * .then(records => console.log(records))
 * .catch(error => console.error(error));
 */
async function getRecords(_, { args }, context) {

  const collection = db.collection("cleanedResale");

  const rangeMap = {
    'yearRange': 'year', 
    'monthRange': 'month', 
    'lonRange':'lng', 
    'latRange': 'lat',
    'dateRange': 'date',
    'sqfRange': 'Sqft',
    'psfRange': 'Psf',
  }
  const inListMap = {
    'towns': 'town',
    'flatTypes': 'flat_type'
  }

  args = updateRangeArgs(args, rangeMap)
  args = updateInListArgs(args, inListMap)

  if ('limit' in args) {
    var limit = args.limit
    delete args.limit
    return await collection.find(args).sort( {"date": -1} ).limit(limit).toArray();
  } else {
    return await collection.find(args).toArray();
  }
}

/**
 * Asynchronously retrieves and calculates the average resale price of records from the 'cleanedResale' MongoDB collection
 * based on specified search criteria. This function constructs an aggregation pipeline that filters records by the provided
 * arguments and groups them by date to calculate the average price. The function currently calculates the average based on
 * `resale_price` but has a TODO note to consider changing this to price per square foot (`psf`).
 *
 * @param {Object} _ - Unused parameter, typically present to adhere to a specific function signature requirement.
 * @param {Object} param1 - An object containing a nested `args` object with search criteria.
 * @param {Object} context - The context object, potentially used for accessing additional configuration or services.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects, each containing a date and the average
 *                                     resale price for that date.
 * 
 * @example
 * // Call getRecordsAveragePrice with specific search criteria
 * getRecordsAveragePrice(null, { args: { yearRange: [2015, 2020], monthRange: [1, 12] } }, {})
 * .then(prices => console.log(prices))
 * .catch(error => console.error(error));
 */
async function getRecordsAveragePrice(_, { args }, context) {
  // get records for specified arguments
  const aggArgs = []

  const collection = db.collection("cleanedResale");


  // if year, month, or date range is provided, use it
  // TODO: might be worth to think if we need to change to throw an error if all are given
  const rangeMap = {
    'yearRange': 'year', 
    'monthRange': 'month',
    'lonRange':'lng',
    'latRange': 'lat',
    'sqfRange': 'Sqft',
    'psfRange': 'Psf',
    'dateRange': 'date'
  }
  const inListMap = {
    'towns': 'town',
    'flatTypes': 'flat_type'
  }

  args = updateRangeArgs(args, rangeMap)
  args = updateInListArgs(args, inListMap)

  for (let [k, v] of Object.entries(args)) {
    aggArgs.push({$match: {[k]: v}})
  }

  aggArgs.push({$group: { _id: "$date", Psf: {$avg: "$Psf" }}}) // TODO change to psf
  
  return await collection.aggregate(aggArgs).toArray();
}


/**
 * Asynchronously retrieves a listing from the MongoDB collection based on the specified document ID.
 * This function searches within the 'testListings' collection for a document matching the provided ObjectId.
 *
 * @param {Object} _ - Unused parameter, typically included to match a specific function signature.
 * @param {Object} param1 - An object containing the `id` of the document to retrieve. The `id` should be a string that can be converted to MongoDB ObjectId.
 * @returns {Promise<Object|null>} - A promise that resolves to the document if found, or null if no document matches the specified ID.
 * 
 * @example
 * // Call getListing to fetch a document by its ID
 * getListing(null, { id: '507f191e810c19729de860ea' })
 * .then(listing => console.log(listing))
 * .catch(error => console.error(error));
 */
async function getListing(_, { id }) {
  let collection = db.collection("listingsData");
  let query = { _id: new ObjectId(id) };
  return await collection.findOne(query);
}


/**
 * Asynchronously retrieves listings from the 'testListings' MongoDB collection based on specified search criteria.
 * This function applies filtering based on geographic coordinates, square footage, price per square foot, and more,
 * provided through `args`. It also supports pagination via a 'limit' argument. The search criteria are adjusted for MongoDB
 * querying using helper functions `updateRangeArgs` and `updateInListArgs`.
 *
 * @param {Object} _ - Unused parameter, typically included to match a specific function signature (e.g., middleware).
 * @param {Object} param1 - An object that encapsulates the `args`, which contains all search and filter parameters.
 * @param {Object} context - Context object potentially used for accessing additional configuration or services.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of listing documents that match the specified criteria.
 *                                     If a 'limit' is set, the number of documents returned is capped at this limit.
 * 
 * @example
 * // Example usage of getListings to fetch documents with specific filters and a limit
 * getListings(null, { args: { lonRange: [34, 40], latRange: [20, 25], sqfRange: [500, 1000], limit: 10 } }, {})
 * .then(listings => console.log(listings))
 * .catch(error => console.error(error));
 */
async function getListings(_, { args }, context) {

  let collection = db.collection("listingsData");

  const rangeMap = {
    'lonRange':'Lon', 
    'latRange': 'Lat',
    'sqfRange': 'Sqft',
    'psfRange': 'Psf',
  }
  const inListMap = {
    'towns': 'town',
    'flatTypes': 'flat_type'
  }
  args = updateRangeArgs(args, rangeMap)
  args = updateInListArgs(args, inListMap)
    
  if ('limit' in args) {
    var limit = args.limit
    delete args.limit
    return await collection.find(args).limit(limit).toArray();
  } else {
    return await collection.find(args).toArray();
  }
}

/**
 * Asynchronously retrieves the latest 100 entries from the 'cleanedResale' MongoDB collection, grouped by postal code.
 * This function uses an aggregation pipeline to fetch the latest available record for each postal code from the most recent
 * 1000 records. It ensures that only the most recent record per postal code, based on the 'date' field, is retrieved.
 *
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of the latest documents for up to 100 unique postal codes.
 * 
 * @example
 * // Call getLatestPostals to fetch the latest documents grouped by postal code
 * getLatestPostals()
 * .then(postals => console.log(postals))
 * .catch(error => console.error(error));
 */
async function getLatestPostals() {
  const collection = db.collection("cleanedResale");

  let arr =  await collection.aggregate([
    { $limit: 1000},
    { $sort: {'date': -1, 'postal': 1, '_id': 1} },
    {
       $group: { '_id': '$postal', 'doc': {'$first': '$$ROOT'} }
    },
    { $replaceRoot: {"newRoot": "$doc"} }
  ]).toArray()
  return arr.slice(0, 100)
}

/**
 * Asynchronously retrieves a list of distinct town names from the 'cleanedResale' MongoDB collection.
 * This function queries the MongoDB database to find all unique values for the 'town' field in the collection,
 * which can be useful for generating dropdowns or other list-based UI components.
 *
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of unique town names.
 * 
 * @example
 * // Call getDistinctTowns to fetch distinct town names
 * getDistinctTowns()
 * .then(towns => console.log(towns))
 * .catch(error => console.error(error));
 */
async function getDistinctTowns() {
  const collection = db.collection("cleanedResale");

  return await collection.distinct('town')
}

/**
 * Asynchronously retrieves a list of distinct flat types from the 'cleanedResale' MongoDB collection.
 * This function queries the MongoDB database to find all unique values for the 'flat_type' field in the collection,
 * which can be useful for generating dropdowns or other list-based UI components.
 *
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of unique flat types.
 * 
 * @example
 * // Call getDistinctFlatTypes to fetch distinct flat types
 * getDistinctFlatTypes()
 * .then(flatTypes => console.log(flatTypes))
 * .catch(error => console.error(error));
 */
async function getDistinctFlatTypes() {
  const collection = db.collection("cleanedResale");

  return await collection.distinct('flat_type')
}


const resolvers = {
  // base TODO; remove if unnecessary
  Record: {
    id: (parent) => parent.id ?? parent._id,
  },
  Query: {
    getRecord,
    getRecords,
    getRecordsAveragePrice,
    getListing,
    getListings,
    getLatestPostals,
    getDistinctTowns,
    getDistinctFlatTypes
  },
};

export default resolvers;
