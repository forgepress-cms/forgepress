#!/usr/bin/env node
import process from 'node:process'
import { run } from './index'

process.exitCode = await run(process.argv.slice(2), process.cwd(), console)
