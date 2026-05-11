# Stress Less — Geliştirme Komutları
# Kullanım: make <komut>

.PHONY: up down build logs migrate revision shell db-reset

# ── Docker ──────────────────────────────────────────────────
up:
	docker-compose up -d

build:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker logs ppg_deneme2-api-1 -f --tail 50

# ── Database ────────────────────────────────────────────────
migrate:
	docker exec ppg_deneme2-api-1 alembic upgrade head

# Yeni migration oluştur: make revision MSG="add_user_avatar"
revision:
	docker exec ppg_deneme2-api-1 alembic revision --autogenerate -m "$(MSG)"

rollback:
	docker exec ppg_deneme2-api-1 alembic downgrade -1

history:
	docker exec ppg_deneme2-api-1 alembic history --verbose

# ── DB Yönetimi ─────────────────────────────────────────────
db-shell:
	docker exec -it ppg_deneme2-db-1 psql -U ppguser ppgdb

db-reset:
	docker exec ppg_deneme2-db-1 psql -U ppguser ppgdb \
		-c "TRUNCATE health_profiles, users RESTART IDENTITY CASCADE;"
	@echo "✓ DB temizlendi"

# ── Debug ───────────────────────────────────────────────────
debug-users:
	curl -s http://localhost:8000/debug/users | python3 -m json.tool

debug-health:
	curl -s http://localhost:8000/debug/health-full | python3 -m json.tool

# ── API testi ───────────────────────────────────────────────
test-register:
	curl -s -X POST http://localhost:8000/auth/register \
		-H "Content-Type: application/json" \
		-d '{"email":"test@test.com","full_name":"Test User","password":"Test1234"}' \
		| python3 -m json.tool

test-login:
	curl -s -X POST http://localhost:8000/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"yesimcetiz@gmail.com","password":"Stres2024"}' \
		| python3 -m json.tool
