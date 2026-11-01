-- Tabla de ejemplo: ni GRANT ni "enable row level security" explícitos.
-- La simulación debe dejarla cerrada, igual que el proyecto real.
create table public.nota_ejemplo (
  id serial primary key,
  duenio uuid not null default auth.uid(),
  texto text not null
);
