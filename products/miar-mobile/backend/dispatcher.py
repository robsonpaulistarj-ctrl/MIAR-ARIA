"""
MIAR ARIA — Sistema de Coordenação Mãe/Filhos
A MIAR principal (mãe) coordena as outras IAs (filhos):
- Aredita (editora de roteiros)
- IA Manutenção (cuida do computador)
- IA Conversação (chat)

Este módulo permite que a MIAR envie comandos para as outras IAs
e receba respostas, funcionando como um "dispatcher" central.
"""

import json
import os
import httpx
from typing import Dict, Any, Optional

# ── Configuração dos Apps Filhos ──────────────────────────────────────────────

CHILD_APPS = {
    "aredita": {
        "name": "Aredita",
        "description": "Editora de Roteiros e Vídeos",
        "icon": "🎬",
        "endpoint": os.getenv("AREDITA_URL", "http://localhost:3001"),
        "enabled": True,
    },
    "manutencao": {
        "name": "IA Manutenção",
        "description": "Cuida do computador — limpeza, backup, otimização",
        "icon": "🔧",
        "endpoint": os.getenv("MANUTENCAO_URL", "http://localhost:3002"),
        "enabled": True,
    },
    "conversacao": {
        "name": "IA Conversação",
        "description": "Chat companionship e companhia",
        "icon": "💬",
        "endpoint": os.getenv("CONVERSAO_URL", "http://localhost:3003"),
        "enabled": True,
    },
}


class Dispatcher:
    """Coordena a comunicação entre a MIAR (mãe) e os apps filhos."""
    
    def __init__(self):
        self.apps = CHILD_APPS.copy()
    
    def get_apps(self):
        """Retorna lista de apps filhos disponíveis."""
        return [
            {
                "id": app_id,
                "name": app["name"],
                "description": app["description"],
                "icon": app["icon"],
                "enabled": app["enabled"],
                "status": "online" if app["enabled"] else "offline",
            }
            for app_id, app in self.apps.items()
        ]
    
    async def send_command(self, app_id: str, command: str, context: str = "") -> Dict[str, Any]:
        """
        Envia um comando da MIAR (mãe) para um app filho.
        
        Args:
            app_id: ID do app (aredita, manutencao, conversacao)
            command: O comando/instrução a enviar
            context: Contexto adicional (histórico, preferências)
        
        Returns:
            Resposta do app filho
        """
        app = self.apps.get(app_id)
        if not app:
            return {"ok": False, "error": f"App '{app_id}' não encontrado"}
        
        if not app["enabled"]:
            return {"ok": False, "error": f"App '{app_id}' está desativado"}
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{app['endpoint']}/api/command",
                    json={
                        "from": "miar-mae",
                        "command": command,
                        "context": context,
                        "timestamp": __import__('time').time()
                    }
                )
                
                if resp.status_code == 200:
                    return {"ok": True, "app": app_id, "response": resp.json()}
                else:
                    return {"ok": False, "error": f"HTTP {resp.status_code}"}
                    
        except httpx.ConnectError:
            return {"ok": False, "error": f"App '{app_id}' não está acessível em {app['endpoint']}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    
    async def broadcast(self, command: str, context: str = "") -> Dict[str, Any]:
        """
        Envia o mesmo comando para todos os apps filhos ativos.
        Útil para comandos gerais da MIAR.
        """
        results = {}
        for app_id in self.apps:
            if self.apps[app_id]["enabled"]:
                results[app_id] = await self.send_command(app_id, command, context)
        return {"ok": True, "results": results}
    
    def toggle_app(self, app_id: str, enabled: bool):
        """Ativa ou desativa um app filho."""
        if app_id in self.apps:
            self.apps[app_id]["enabled"] = enabled
            return {"ok": True}
        return {"ok": False, "error": "App não encontrado"}


# Instância global
dispatcher = Dispatcher()
