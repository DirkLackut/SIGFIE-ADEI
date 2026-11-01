# Quita de un informe HTML de Newman tokens, contraseñas y correos de las cuentas sintéticas.
import re, sys
for ruta in sys.argv[1:]:
    s = open(ruta, encoding="utf-8").read(); antes = len(s)
    s = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*", "[token omitido]", s)
    s = re.sub(r"(&quot;(?:refresh_token|password)&quot;:&quot;)[^&]*(&quot;)", r"\1[omitido]\2", s)
    s = re.sub(r"(\"(?:refresh_token|password)\":\")[^\"]*(\")", r"\1[omitido]\2", s)
    s = s.replace("Prueba Local 2026", "[omitido]")
    s = re.sub(r"u-[0-9a-f-]{36}@sigfie\.invalid", "[correo sintético]", s)
    open(ruta, "w", encoding="utf-8").write(s)
    print(ruta.split("/")[-1], "limpio:", antes - len(s), "caracteres menos")
