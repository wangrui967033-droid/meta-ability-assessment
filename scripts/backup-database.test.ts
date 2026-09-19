// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { backupDatabase } from './backup-database.mjs'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'meta-ability-backup-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function createAssessmentDatabase(path: string): void {
  const database = new DatabaseSync(path)
  database.exec(`
    CREATE TABLE assessments (id TEXT PRIMARY KEY);
    INSERT INTO assessments (id) VALUES ('${randomUUID()}');
  `)
  database.close()
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe('backupDatabase', () => {
  it('creates a timestamped, readable SQLite copy with all assessments', async () => {
    const root = await temporaryDirectory()
    const sourcePath = join(root, 'data', 'assessments.sqlite')
    const backupDirectory = join(root, 'backups')
    await mkdir(join(root, 'data'))
    createAssessmentDatabase(sourcePath)

    const destinationPath = await backupDatabase({
      sourcePath,
      backupDirectory,
      now: new Date('2026-09-10T12:34:56.789Z'),
    })

    expect(basename(destinationPath)).toBe('meta-ability-20260910-123456.sqlite')
    expect(await readdir(backupDirectory)).toEqual(['meta-ability-20260910-123456.sqlite'])

    const backup = new DatabaseSync(destinationPath, { readOnly: true })
    expect(backup.prepare('SELECT COUNT(*) AS total FROM assessments').get()).toEqual({ total: 1 })
    backup.close()

    expect((await stat(backupDirectory)).mode & 0o777).toBe(0o700)
    expect((await stat(destinationPath)).mode & 0o777).toBe(0o600)
  })

  it('corrects an existing backup directory to owner-only permissions', async () => {
    const root = await temporaryDirectory()
    const sourcePath = join(root, 'assessments.sqlite')
    const backupDirectory = join(root, 'backups')
    createAssessmentDatabase(sourcePath)
    await mkdir(backupDirectory, { mode: 0o777 })
    await chmod(backupDirectory, 0o777)

    await backupDatabase({ sourcePath, backupDirectory })

    expect((await stat(backupDirectory)).mode & 0o777).toBe(0o700)
  })

  it('rejects an active uncheckpointed WAL database without publishing a backup', async () => {
    const root = await temporaryDirectory()
    const sourcePath = join(root, 'assessments.sqlite')
    const backupDirectory = join(root, 'backups')
    await mkdir(backupDirectory)
    const database = new DatabaseSync(sourcePath)
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA wal_autocheckpoint = 0;
      CREATE TABLE assessments (id TEXT PRIMARY KEY);
      INSERT INTO assessments (id) VALUES ('${randomUUID()}');
    `)

    expect((await stat(`${sourcePath}-wal`)).size).toBeGreaterThan(0)
    await expect(backupDatabase({ sourcePath, backupDirectory })).rejects.toThrow(
      '存在未检查点的 SQLite',
    )
    expect(await readdir(backupDirectory)).toEqual([])
    database.close()
  })

  it.each([
    ['source path', { sourcePath: '', backupDirectory: 'backups' }],
    ['backup directory', { sourcePath: 'data/assessments.sqlite', backupDirectory: '' }],
  ])('rejects an empty %s', async (_label, paths) => {
    await expect(backupDatabase(paths)).rejects.toThrow('不能为空')
  })

  it('refuses a generated destination equal to the active database path', async () => {
    const root = await temporaryDirectory()
    const sourcePath = join(root, 'meta-ability-20260910-123456.sqlite')
    createAssessmentDatabase(sourcePath)

    await expect(
      backupDatabase({
        sourcePath,
        backupDirectory: root,
        now: new Date('2026-09-10T12:34:56.789Z'),
      }),
    ).rejects.toThrow('备份目标不能与正在使用的数据库相同')
  })
})
