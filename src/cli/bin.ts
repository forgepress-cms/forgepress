#!/usr/bin/env node
import process from 'node:process'
import { runMain } from 'citty'
import { createCli } from './commands'

await runMain(createCli(process.cwd()))
