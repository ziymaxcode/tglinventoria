import express from 'express';
import { apiRouter } from '../server';

const app = express();

app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;