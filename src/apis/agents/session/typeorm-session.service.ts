import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  BaseSessionService,
  CreateSessionRequest,
  GetSessionRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  DeleteSessionRequest,
  AppendEventRequest,
  Session,
  createSession,
} from '@google/adk';
import type { Event } from '@google/adk';
import { AgentSession } from '../entities/agent-session.entity';
import * as crypto from 'crypto';

@Injectable()
export class TypeOrmSessionService extends BaseSessionService {
  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
  ) {
    super();
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const id = request.sessionId || crypto.randomUUID();
    const lastUpdateTime = Date.now();

    const newSession = this.sessionRepo.create({
      id,
      appName: request.appName,
      userId: request.userId,
      state: request.state || {},
      events: [],
      lastUpdateTime: lastUpdateTime.toString(),
    });

    await this.sessionRepo.save(newSession);

    return createSession({
      id: newSession.id,
      appName: newSession.appName,
      userId: newSession.userId,
      state: newSession.state,
      events: [],
      lastUpdateTime: Number(newSession.lastUpdateTime),
    });
  }

  async getSession(request: GetSessionRequest): Promise<Session | undefined> {
    const sessionRecord = await this.sessionRepo.findOne({
      where: {
        id: request.sessionId,
        appName: request.appName,
        userId: request.userId,
      },
    });

    if (!sessionRecord) {
      return undefined;
    }

    let events = sessionRecord.events as Event[];

    if (request.config) {
      const { numRecentEvents, afterTimestamp } = request.config;

      if (afterTimestamp !== undefined) {
        events = events.filter((e) => e.timestamp > afterTimestamp);
      }

      if (numRecentEvents !== undefined) {
        events = events.slice(-numRecentEvents);
      }
    }

    return createSession({
      id: sessionRecord.id,
      appName: sessionRecord.appName,
      userId: sessionRecord.userId,
      state: sessionRecord.state,
      events,
      lastUpdateTime: Number(sessionRecord.lastUpdateTime),
    });
  }

  async listSessions(
    request: ListSessionsRequest,
  ): Promise<ListSessionsResponse> {
    const { appName, userId, limit, offset, page, order } = request;

    const queryBuilder = this.sessionRepo.createQueryBuilder('session');

    queryBuilder.where('session.appName = :appName', { appName });

    if (userId) {
      queryBuilder.andWhere('session.userId = :userId', { userId });
    }

    if (order) {
      queryBuilder.orderBy(
        'session.lastUpdateTime',
        order.toUpperCase() as 'ASC' | 'DESC',
      );
    }

    const take = limit || 10;
    const calculatedOffset = page ? (page - 1) * take : offset || 0;

    queryBuilder.take(take).skip(calculatedOffset);

    const [sessionRecords, totalItems] = await queryBuilder.getManyAndCount();

    const sessions = sessionRecords.map((record) =>
      createSession({
        id: record.id,
        appName: record.appName,
        userId: record.userId,
        state: record.state,
        events: [],
        lastUpdateTime: Number(record.lastUpdateTime),
      }),
    );

    return {
      sessions,
      totalItems,
      page: page || Math.floor(calculatedOffset / take) + 1,
      limit: take,
      totalPages: Math.ceil(totalItems / take),
    };
  }

  async deleteSession(request: DeleteSessionRequest): Promise<void> {
    await this.sessionRepo.delete({
      id: request.sessionId,
      appName: request.appName,
      userId: request.userId,
    });
  }

  async appendEvent(request: AppendEventRequest): Promise<Event> {
    const event = await super.appendEvent(request);

    const sessionRecord = await this.sessionRepo.findOne({
      where: {
        id: request.session.id,
        appName: request.session.appName,
        userId: request.session.userId,
      },
    });

    if (!sessionRecord) {
      throw new Error('Session not found');
    }

    sessionRecord.state = request.session.state;
    sessionRecord.events.push(event);
    sessionRecord.lastUpdateTime = Date.now().toString();

    await this.sessionRepo.save(sessionRecord);

    return event;
  }
}

export class StandaloneTypeOrmSessionService extends TypeOrmSessionService {
  constructor(dataSource: DataSource) {
    const sessionRepo = dataSource.getRepository(AgentSession);
    super(sessionRepo);
  }
}
