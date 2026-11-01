-- Solo funciona si 001 ya se aplicó: comprueba el orden.
create table public.grupo_ejemplo (id int primary key, nivel_id int not null references public.nivel_ejemplo(id));
