import express from 'express';
import { apiRouter } from '../server'; // Requires the compiled .js or runs natively via Vercel TS compilation depending on settings

const app = express();
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
