import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentSessionAndMemory1760000016000 implements MigrationInterface {
  name = 'CreateAgentSessionAndMemory1760000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "agent_sessions" (
                "id" character varying NOT NULL,
                "app_name" character varying NOT NULL,
                "user_id" character varying NOT NULL,
                "state" jsonb NOT NULL DEFAULT '{}',
                "events" jsonb NOT NULL DEFAULT '[]',
                "last_update_time" bigint NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_agent_sessions_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "agent_memories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "scope" character varying NOT NULL,
                "key" character varying NOT NULL,
                "value" jsonb NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_agent_memories_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_agent_memories_scope_key" ON "agent_memories" ("scope", "key")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_agent_memories_scope_key"`,
    );
    await queryRunner.query(`DROP TABLE "agent_memories"`);
    await queryRunner.query(`DROP TABLE "agent_sessions"`);
  }
}
