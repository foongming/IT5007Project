import 'dotenv/config';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4'; 
import resolvers from './resolvers.js';
import { readFileSync } from 'fs';
import cors from 'cors';
import gql from 'graphql-tag'; 

// Express app
const app = express();

// Enable CORS
app.use(cors());

// Middleware
app.use(express.json());

// Initialize GraphQL schema
const typeDefs = gql(
  readFileSync('schema.graphql', { encoding: 'utf-8' })
);

// Initialize Apollo server
const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
});

async function startServer() {
  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async () => ({ /* context here */ }),
    })
  );

  app.get('/', (req, res) => {
    res.send('Home Route');
  });

  // Listen for requests
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log('connected to db and listening on port ', process.env.PORT)
  });
}

startServer();
