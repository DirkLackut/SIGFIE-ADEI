-- Con "Automatically expose new tables" apagado, NINGÚN rol de la API recibe
-- permisos solo: ni authenticated ni service_role. Hay que darlos explícitos.
grant select, insert on public.nota_ejemplo to authenticated;
grant usage on sequence public.nota_ejemplo_id_seq to authenticated;
grant select on public.nota_ejemplo to service_role;
create policy ver_propias on public.nota_ejemplo for select to authenticated using (duenio = auth.uid());
create policy crear_propias on public.nota_ejemplo for insert to authenticated with check (duenio = auth.uid());
