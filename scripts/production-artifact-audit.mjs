import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { findStudentBundleLeaks } from './student-bundle-audit.mjs'

const secretConfigurationKeys = [
  'ADMIN_PASSWORD_HASH',
  'SESSION_SECRET',
  'PHONE_ENCRYPTION_KEY',
  'PHONE_LOOKUP_SECRET',
]

const knownFallbackSecretLiterals = [
  'scrypt$16384$8$1$$',
  'test-session-secret',
  'test-phone-encryption-key',
  'test-phone-lookup-secret',
]

const secretAssignmentNames = {
  ADMIN_PASSWORD_HASH: 'ADMIN_PASSWORD_HASH',
  SESSION_SECRET: 'SESSION_SECRET',
  PHONE_ENCRYPTION_KEY: 'PHONE_ENCRYPTION_KEY',
  PHONE_LOOKUP_SECRET: 'PHONE_LOOKUP_SECRET',
  adminPasswordHash: 'ADMIN_PASSWORD_HASH',
  sessionSecret: 'SESSION_SECRET',
  phoneEncryptionKey: 'PHONE_ENCRYPTION_KEY',
  phoneLookupSecret: 'PHONE_LOOKUP_SECRET',
}

const secretLiteralAssignment = new RegExp(
  `\\b(${Object.keys(secretAssignmentNames).join('|')})\\b\\s*[:=]\\s*["'\`]([^"'\`\\r\\n]+)["'\`]`,
  'g',
)

const publicPrivateMarkers = [
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
  'PHONE_ENCRYPTION_KEY',
  'PHONE_LOOKUP_SECRET',
  'phone_encrypted',
]

const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.map', '.txt'])

function effectiveConfiguredSecrets(env) {
  return Object.fromEntries(secretConfigurationKeys.flatMap((key) => {
    const value = env[key]?.trim()
    return value ? [[key, value]] : []
  }))
}

export function configuredSecretKeys(env) {
  return Object.keys(effectiveConfiguredSecrets(env))
}

export function findConfiguredSecretLeaks(artifact, env) {
  return Object.entries(effectiveConfiguredSecrets(env))
    .filter(([, value]) => artifact.includes(value))
    .map(([key]) => key)
}

export function findServerDefaultSecretLeaks(artifact) {
  const leaks = []
  if (knownFallbackSecretLiterals.some((literal) => artifact.includes(literal))) {
    leaks.push('known test/fallback secret literal')
  }

  for (const match of artifact.matchAll(secretLiteralAssignment)) {
    const configuredName = secretAssignmentNames[match[1]]
    leaks.push(`literal default for ${configuredName}`)
  }
  return [...new Set(leaks)]
}

export function formatConfiguredSecretAudit(count) {
  return count === 0
    ? 'Configured secret value audit skipped: no non-empty configured secret values were available.'
    : `Audited ${count} configured secret values against all production artifacts.`
}

async function artifactFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return artifactFiles(path)
    return textExtensions.has(extname(entry.name)) ? [path] : []
  }))
  return nested.flat()
}

export async function auditProductionArtifacts({ env = process.env } = {}) {
  const publicFiles = await artifactFiles('dist')
  const serverFiles = await artifactFiles('dist-server')
  const configuredLeaks = []
  const configuredKeys = configuredSecretKeys(env)

  for (const path of [...publicFiles, ...serverFiles]) {
    const artifact = await readFile(path, 'utf8')
    for (const key of findConfiguredSecretLeaks(artifact, env)) {
      configuredLeaks.push(`${path}: configured value for ${key}`)
    }
  }

  const serverDefaultLeaks = []
  for (const path of serverFiles) {
    const artifact = await readFile(path, 'utf8')
    for (const leak of findServerDefaultSecretLeaks(artifact)) {
      serverDefaultLeaks.push(`${path}: ${leak}`)
    }
  }

  const publicLeaks = []
  for (const path of publicFiles) {
    const artifact = await readFile(path, 'utf8')
    const markers = publicPrivateMarkers.filter((marker) => artifact.includes(marker))
    const answers = findStudentBundleLeaks(artifact)
    for (const leak of [...markers.map((marker) => `private marker ${marker}`), ...answers]) {
      publicLeaks.push(`${path}: ${leak}`)
    }
  }

  const leaks = [...configuredLeaks, ...serverDefaultLeaks, ...publicLeaks]
  if (leaks.length > 0) {
    throw new Error(`Unsafe production artifacts:\n${leaks.join('\n')}`)
  }

  return {
    publicFiles,
    serverFiles,
    configuredSecretValueCount: configuredKeys.length,
  }
}

async function main() {
  const result = await auditProductionArtifacts()
  console.log(formatConfiguredSecretAudit(result.configuredSecretValueCount))
  console.log(
    `Production artifact audit passed: ${result.publicFiles.length} public files, ${result.serverFiles.length} server files.`,
  )
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Production artifact audit failed')
    process.exitCode = 1
  })
}
