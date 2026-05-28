# SafeDeal — Database Schema

PostgreSQL 15. Автомиграции при старте сервера через _migrations таблицу.

## users
| Поле | Тип | Описание |
|------|-----|----------|
| id | SERIAL PK | |
| telegram_id | BIGINT UNIQUE | Telegram user ID |
| username | VARCHAR | @username |
| first_name | VARCHAR | |
| last_name | VARCHAR | |
| ton_wallet_address | VARCHAR | UQ.../EQ... |
| rating | NUMERIC(3,2) | 0.00–5.00 |
| deals_count | INT DEFAULT 0 | Завершённые сделки (deals_completed) |
| deals_completed | INT DEFAULT 0 | Псевдоним deals_count |
| level | INT DEFAULT 1 | = deals_completed / 2 |
| xp | INT DEFAULT 0 | Очки опыта |
| streak_days | INT DEFAULT 0 | Серия дней входа |
| safe_coins | INT DEFAULT 0 | Внутренняя валюта |
| is_verified | BOOLEAN DEFAULT false | |
| bio | TEXT | max 300 символов |
| role | VARCHAR | client / freelancer / both |
| category | VARCHAR | design/dev/writing/video/marketing/other |
| skills | JSONB | Массив строк (max 15) |
| experience | VARCHAR | junior / middle / senior |
| account_type | VARCHAR | individual / company |
| company_name | VARCHAR | |
| company_url | VARCHAR | |
| country | VARCHAR | |
| portfolio_url | VARCHAR | |
| github_url | VARCHAR | |
| profile_completed | BOOLEAN DEFAULT false | |
| banner_url | VARCHAR | /banners/{filename} |
| avatar_url | VARCHAR | /avatars/{filename} |
| slide_images | JSONB | Массив URL (max 5) |
| referral_code | VARCHAR UNIQUE | |
| referral_count | INT DEFAULT 0 | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | |

XP функция: `add_xp(user_id, amount)` — добавляет XP и пересчитывает level.

## rooms
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK DEFAULT gen_random_uuid() | |
| invite_link | UUID UNIQUE | Публичная ссылка для фрилансера |
| status | VARCHAR | waiting / active / completed / disputed / cancelled |
| client_id | INT FK users | |
| freelancer_id | INT FK users NULL | Появляется при принятии |
| created_at | TIMESTAMPTZ | |
| closed_at | TIMESTAMPTZ | |

## contracts
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| room_id | UUID FK rooms | |
| title | VARCHAR | |
| description | TEXT | |
| amount_usd | NUMERIC(10,2) | max 500 |
| currency | VARCHAR | TON / USDT |
| crypto_amount | NUMERIC | Рассчитывается при деплое |
| deadline | TIMESTAMPTZ | |
| criteria | JSONB | [{ text, required }] min 3 |
| status | VARCHAR | draft / pending_signature / signed / awaiting_payment / in_progress / under_review / completed / disputed / disputed_resolved / refunded |
| signed_by_client | BOOLEAN DEFAULT false | |
| signed_by_freelancer | BOOLEAN DEFAULT false | |
| ton_contract_address | VARCHAR | Адрес смарт-контракта в TON |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## escrow
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| contract_id | UUID FK contracts | |
| currency | VARCHAR | TON / USDT |
| amount | NUMERIC | В крипте |
| amount_usd | NUMERIC | В USD |
| platform_fee | NUMERIC | 2% |
| status | VARCHAR | waiting_payment / frozen / released / refunded |
| ton_contract_address | VARCHAR | |
| tx_hash_in | VARCHAR | Хеш депозита |
| tx_hash_out | VARCHAR | Хеш release/refund |
| frozen_at | TIMESTAMPTZ | |
| released_at | TIMESTAMPTZ | |

## deliveries
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| contract_id | UUID FK contracts | |
| description | TEXT | |
| files | JSONB | [{ fileId, originalName, previewPath, encryptedPath, mimeType, size, fileType }] |
| links | JSONB | Массив ссылок |
| status | VARCHAR | submitted / reviewing / approved / rejected |
| attempt_number | INT | Порядковый номер попытки |
| submitted_at | TIMESTAMPTZ | |
| reviewed_at | TIMESTAMPTZ | |
| review_comment | TEXT | Комментарий при reject |

## checklist_items
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| contract_id | UUID FK contracts | |
| delivery_id | UUID FK deliveries | |
| criterion | TEXT | Текст критерия |
| criterion_index | INT | Порядок |
| is_checked | BOOLEAN DEFAULT false | |
| checked_at | TIMESTAMPTZ | |
| comment | TEXT | |

## disputes
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| contract_id | UUID FK contracts | |
| opened_by | INT FK users | |
| reason | TEXT | |
| client_evidence | JSONB | |
| freelancer_evidence | JSONB | |
| status | VARCHAR | open / reviewing / resolved |
| decision | VARCHAR | client_wins / freelancer_wins / split |
| split_percent | INT | 0–100, для split |
| resolved_at | TIMESTAMPTZ | |

## portfolio_items
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| freelancer_id | INT FK users | |
| contract_id | UUID FK contracts | |
| title | VARCHAR | |
| description | TEXT | |
| preview_url | VARCHAR | |
| tags | JSONB | |
| is_visible | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |

Создаётся автоматически при delivery.approve.

## job_posts
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| client_id | INT FK users | |
| title | VARCHAR | min 5, max 256 |
| description | TEXT | min 20 |
| budget_min | NUMERIC | |
| budget_max | NUMERIC | max 500 |
| currency | VARCHAR | TON / USDT |
| deadline | INT | Дней |
| category | VARCHAR | |
| skills_required | JSONB | |
| status | VARCHAR | open / in_review / closed / taken |
| created_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |

Полнотекстовый поиск: to_tsvector('english', title || description).

## job_applications
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| job_post_id | UUID FK job_posts | |
| freelancer_id | INT FK users | |
| cover_letter | TEXT | |
| proposed_amount | NUMERIC | |
| status | VARCHAR | pending / accepted / rejected |
| created_at | TIMESTAMPTZ | |

UNIQUE (job_post_id, freelancer_id) — один отклик на вакансию.

## audit_log
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| contract_id | UUID FK contracts | |
| action | VARCHAR | contract_created / deploy_contract / deposit / release / refund / split / ... |
| performed_by | INT | user.id |
| details | JSONB | Детали операции |
| tx_hash | VARCHAR | Хеш транзакции TON |
| created_at | TIMESTAMPTZ | |

Логируются все финансовые операции.

## notifications
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| user_id | INT FK users | |
| type | VARCHAR | |
| message | TEXT | |
| photo_url | VARCHAR | |
| is_read | BOOLEAN DEFAULT false | |
| payload | JSONB | |
| created_at | TIMESTAMPTZ | |

## reviews
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| reviewer_id | INT FK users | |
| reviewee_id | INT FK users | |
| contract_id | UUID FK contracts | |
| rating | NUMERIC(2,1) | 1.0–5.0 |
| comment | TEXT | |
| created_at | TIMESTAMPTZ | |

## quests
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| key | VARCHAR UNIQUE | link_wallet / complete_profile / first_deal / ... |
| title | VARCHAR | |
| description | TEXT | |
| coins | INT | Награда в SafeCoins |
| is_active | BOOLEAN | |
| is_repeatable | BOOLEAN | |
| sort_order | INT | |

## user_quests
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| user_id | INT FK users | |
| quest_id | UUID FK quests | |
| completed_at | TIMESTAMPTZ | |

UNIQUE (user_id, quest_id).

## Дополнительные таблицы (admin.js)

### platform_settings
key VARCHAR PK | value TEXT | updated_at

Стандартные ключи: platform_fee_percent, max_deal_amount_usd, simulate_payments, maintenance_mode, maintenance_message

### banned_users
telegram_id BIGINT PK | reason TEXT | banned_at

### commission_history
id SERIAL | value NUMERIC(5,2) | changed_at

### broadcast_queue
id UUID PK | message TEXT | photo_url | segment (all/clients/freelancers) | push_app BOOLEAN | scheduled_at | status (pending/sent/cancelled/failed) | sent_at | sent_count | failed_count

## Статус контракта — жизненный цикл
```
draft
  → pending_signature (при создании)
  → signed (оба подписали)
  → awaiting_payment (задеплоен смарт-контракт)
  → in_progress (депозит получен, заморожен)
  → under_review (фрилансер сдал работу)
  → completed (клиент принял)
  → disputed (открыт спор)
  → disputed_resolved (спор решён)
  → refunded (возврат)
```

## Статус эскроу — жизненный цикл
```
waiting_payment → frozen → released
                       ↘ refunded
```
