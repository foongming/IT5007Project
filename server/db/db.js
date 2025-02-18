import * as dotenv from 'dotenv'
import {MongoClient} from 'mongodb'

dotenv.config()
const uri = process.env.ATLAS_URI

const client = new MongoClient(uri)

let conn;

try {
    conn = await client.connect()
    console.log('MongoDB connection successful')
} catch(e) {
    console.error(e)
}

let db = conn.db("hdbData");
export default db;