import type { Server } from 'node:http'
import { pathToFileURL } from 'node:url'

import { createApiServer } from './api'
import { loadServerConfig, type ServerConfig } from './config'
import { openDatabase, type AssessmentDatabase } from './database'
import { createSecurity } from './security'

interface ServerLogger {
  log(message: string): void
  error(message: string, details?: unknown): void
}

export interface RunningAssessmentServer {
  server: Server
  database: AssessmentDatabase
  close(): Promise<void>
}

export async function startAssessmentServer(
  config: ServerConfig,
  logger: ServerLogger = console,
): Promise<RunningAssessmentServer> {
  const database = openDatabase(config.databasePath)
  const security = createSecurity(config)
  const server = createApiServer({ database, security, config, logger })

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error)
      server.once('error', onError)
      server.listen(config.port, config.host, () => {
        server.off('error', onError)
        resolve()
      })
    })
  } catch (error) {
    database.close()
    throw error
  }

  const address = server.address()
  const port = address && typeof address === 'object' ? address.port : config.port
  logger.log(`Assessment server listening on ${config.host}:${port}`)

  let closed = false
  return {
    server,
    database,
    close() {
      if (closed) return Promise.resolve()
      closed = true
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          database.close()
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }
}

async function main(): Promise<void> {
  const running = await startAssessmentServer(loadServerConfig(process.env))
  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    void running.close().catch(() => {
      process.exitCode = 1
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void main().catch((error: unknown) => {
    console.error('Assessment server failed to start', {
      errorName: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : '未知错误',
    })
    process.exitCode = 1
  })
}
