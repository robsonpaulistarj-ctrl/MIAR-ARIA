#!/usr/bin/env python3
"""
Gera certificados SSL auto-assinados para o backend mobile.
Isso permite que o microfone (Web Speech API) funcione no celular
via HTTPS, mesmo na rede local.

Uso:
    python3 https_setup.py
    python3 server.py --https
"""

import subprocess
import os
import sys

CERT_DIR = os.path.dirname(os.path.abspath(__file__))
CERT_FILE = os.path.join(CERT_DIR, "server.crt")
KEY_FILE = os.path.join(CERT_DIR, "server.key")


def generate_certs():
    """Gera certificados auto-assinados se não existirem."""
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        print(f"✅ Certificados já existem:\n   {CERT_FILE}\n   {KEY_FILE}")
        return True

    print("🔐 Gerando certificados SSL auto-assinados...")

    # Verificar se openssl está disponível
    try:
        subprocess.run(["openssl", "version"], capture_output=True, check=True)
    except FileNotFoundError:
        print("❌ OpenSSL não encontrado. Instale com:")
        print("   Windows: https://slproweb.com/products/Win32OpenSSL.html")
        print("   Ubuntu: sudo apt install openssl")
        return False

    # Gerar certificado
    cmd = [
        "openssl", "req", "-x509", "-newkey", "rsa:2048",
        "-keyout", KEY_FILE,
        "-out", CERT_FILE,
        "-days", "365",
        "-nodes",
        "-subj", "/CN=MIAR-ARIA/C=BR/O=MIAR/OU=Personal",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"✅ Certificados gerados com sucesso!")
        print(f"   Certificado: {CERT_FILE}")
        print(f"   Chave: {KEY_FILE}")
        print(f"\n⚠️  No celular, aceite o certificado de segurança quando aparecer o aviso.")
        return True
    else:
        print(f"❌ Erro ao gerar certificados: {result.stderr}")
        return False


if __name__ == "__main__":
    generate_certs()
