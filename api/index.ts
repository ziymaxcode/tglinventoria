import express from 'express';
import { apiRouter } from '../server'; // Requires the compiled .js or runs natively via Vercel TS compilation depending on settings

const app = express();
app.use(apiRouter); // We stripped out the "/api" prefix from apiRouter, Vercel routes `/api/*` to here, so it works perfectly.

export default app;
