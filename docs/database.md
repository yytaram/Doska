# Database schema and reference data

Doska uses PostgreSQL through Prisma. The first migration creates users,
sessions, profiles, categories, cities, ads, offers, favorites, blocks, reports,
moderation terms, audit logs and device tokens.

## Setup

Start Docker Desktop and create `apps/api/.env` from `.env.example`, then run:

```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm test
```

The migration command is for local development. A hosted environment should use
`pnpm db:deploy`, which applies checked-in migrations without trying to create a
new one.

`pnpm db:seed` is safe to rerun. It updates categories and cities by stable slug
instead of creating duplicates.

To rebuild only the local PostgreSQL schema from the checked-in migrations:

```bash
pnpm db:reset
```

This permanently deletes all data in the configured database, reapplies every
migration and runs the seed. Never point that command at staging or production.

## Categories to review

1. Электроника
2. Телефоны и компьютеры
3. Авто
4. Дом и мебель
5. Одежда
6. Детское
7. Спорт и хобби
8. Услуги

These broad categories are intentionally small for the first beta. More precise
subcategories can be added after observing fake-data testing.

## Kazakhstan cities to review

The seed contains 90 cities, matching the official Bureau of National
Statistics count published for 1 July 2026. They are grouped as follows:

| Region                           | Seeded cities                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Города республиканского значения | Алматы, Астана, Шымкент                                                                                 |
| Область Абай                     | Семей, Курчатов, Аягоз, Шар                                                                             |
| Акмолинская область              | Кокшетау, Косшы, Степногорск, Акколь, Атбасар, Державинск, Ерейментау, Есиль, Макинск, Степняк, Щучинск |
| Актюбинская область              | Актобе, Алга, Жем, Кандыагаш, Темир, Хромтау, Шалкар, Эмба                                              |
| Алматинская область              | Конаев, Есик, Каскелен, Талгар, Алатау                                                                  |
| Атырауская область               | Атырау, Кульсары                                                                                        |
| Западно-Казахстанская область    | Уральск, Аксай                                                                                          |
| Жамбылская область               | Тараз, Каратау, Жанатас, Шу                                                                             |
| Область Жетысу                   | Талдыкорган, Текели, Ушарал, Уштобе, Сарканд, Жаркент                                                   |
| Карагандинская область           | Караганда, Балхаш, Приозёрск, Сарань, Темиртау, Шахтинск, Абай, Каркаралинск                            |
| Костанайская область             | Костанай, Аркалык, Лисаковск, Рудный, Житикара, Тобыл                                                   |
| Кызылординская область           | Кызылорда, Байконур, Аральск, Казалинск                                                                 |
| Мангистауская область            | Актау, Жанаозен, Форт-Шевченко                                                                          |
| Павлодарская область             | Павлодар, Аксу, Экибастуз                                                                               |
| Северо-Казахстанская область     | Петропавловск, Булаево, Мамлютка, Сергеевка, Тайынша                                                    |
| Туркестанская область            | Туркестан, Арыс, Кентау, Жетысай, Ленгер, Сарыагаш, Шардара                                             |
| Область Улытау                   | Жезказган, Сатпаев, Каражал                                                                             |
| Восточно-Казахстанская область   | Усть-Каменогорск, Риддер, Алтай, Зайсан, Серебрянск, Шемонаиха                                          |

Reference count: [Bureau of National Statistics of Kazakhstan — administrative-territorial units, 1 July 2026](https://stat.gov.kz/ru/industries/social-tatistics/demography/publications/335821/).

## Database-enforced rules

- Every ad has one owner, category and city.
- A seller can have only one offer for a particular ad.
- An ad owner cannot send an offer on their own ad, even through a direct
  database write.
- Changing an ad owner cannot create a self-offer relationship.
- Budgets and offer prices cannot be negative.
- A user cannot block themselves.
- A report must reference exactly one target matching its target type.
- Foreign keys define which records cascade, remain protected or become
  anonymous when a related record is removed.

The cross-table ownership checks use PostgreSQL triggers because ordinary SQL
`CHECK` constraints cannot query the ad table. Integration tests exercise these
rules against the real local database.
