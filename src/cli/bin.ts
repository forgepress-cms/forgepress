#!/usr/bin/env node
import process from 'node:process'
import { runMain } from 'citty'
import { createCli } from './index'

await runMain(createCli(process.cwd()))
