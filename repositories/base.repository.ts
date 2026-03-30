// ----------------------------------------------------------------
// BaseRepository — Katman 8
// Soyut temel repository. Tum ozel repository'ler bunu extend eder.
// Parametrize sorgular — SQL injection imkansiz.
// ----------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { QueryOptions, PaginatedResult } from '@/lib/db/types'

export abstract class BaseRepository<T extends { id: string }> {
  constructor(protected readonly supabase: SupabaseClient) {}

  protected abstract tableName: string

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // no rows
      throw new Error(`${this.tableName}.findById basarisiz: ${error.message}`)
    }

    return data as T
  }

  async findMany(
    filters: Partial<Record<string, unknown>> = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    let query = this.supabase.from(this.tableName).select('*')

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    }

    if (options.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection !== 'desc',
      })
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit ?? 20) - 1
      )
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`${this.tableName}.findMany basarisiz: ${error.message}`)
    }

    return (data ?? []) as T[]
  }

  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`${this.tableName}.create basarisiz: ${error.message}`)
    }

    return result as T
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`${this.tableName}.update basarisiz: ${error.message}`)
    }

    return result as T
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`${this.tableName}.delete basarisiz: ${error.message}`)
    }
  }

  async findPaginated(
    filters: Partial<Record<string, unknown>> = {},
    page: number = 1,
    pageSize: number = 20,
    options: Pick<QueryOptions, 'orderBy' | 'orderDirection'> = {}
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize

    // Count query
    let countQuery = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        countQuery = countQuery.eq(key, value)
      }
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      throw new Error(`${this.tableName}.findPaginated count basarisiz: ${countError.message}`)
    }

    // Data query
    let dataQuery = this.supabase
      .from(this.tableName)
      .select('*')
      .range(offset, offset + pageSize - 1)

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        dataQuery = dataQuery.eq(key, value)
      }
    }

    if (options.orderBy) {
      dataQuery = dataQuery.order(options.orderBy, {
        ascending: options.orderDirection !== 'desc',
      })
    }

    const { data, error } = await dataQuery

    if (error) {
      throw new Error(`${this.tableName}.findPaginated basarisiz: ${error.message}`)
    }

    return {
      data: (data ?? []) as T[],
      total: count ?? 0,
      page,
      pageSize,
    }
  }

  async findByJsonbField(
    column: string,
    path: string,
    value: unknown
  ): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .filter(`${column}->>${path}`, 'eq', String(value))

    if (error) {
      throw new Error(`${this.tableName}.findByJsonbField basarisiz: ${error.message}`)
    }

    return (data ?? []) as T[]
  }
}
