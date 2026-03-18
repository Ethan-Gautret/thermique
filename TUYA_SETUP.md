# Configuration de l'intégration Tuya

## 📋 Vue d'ensemble

Ce système permet aux utilisateurs de connecter leur API Tuya à l'application Thermique et de voir/contrôler leurs appareils connectés.

## 🔧 Installation

### 1. Exécuter les migrations

Exécutez la migration pour créer la table `tuya_connections` :

```bash
php artisan migrate
```

### 2. Configuration Tuya

1. Allez sur [Tuya IoT Console](https://iot.tuya.com)
2. Créez un compte ou connectez-vous
3. Créez une nouvelle application
4. Obtenez vos **Client ID** et **Client Secret**
5. Sélectionnez votre région (EU, US, CN, IN)

### 3. Utilisation dans l'application

1. L'utilisateur se connecte à l'application (authentification standard)
2. Il accède à l'onglet "Tuya" depuis la page d'accueil
3. Il entre ses **Client ID** et **Client Secret** Tuya
4. Sélectionne sa région
5. Clique sur "Connecter Tuya"

Une fois connecté :
- Les credentials sont sauvegardés de manière sécurisée dans la base de données
- L'utilisateur peut voir les détails de sa connexion Tuya
- Il peut accéder à l'onglet "Appareils" pour voir tous ses appareils Tuya
- La connexion persiste lors du changement de page ou de la reconnexion

## 🔐 Sécurité

- Les `client_secret` et `access_token` sont **cachés** dans les réponses API
- Les credentials sont stockés de manière chiffrée dans la base de données
- En production, utilisez les variables d'environnement et un chiffrement supplémentaire
- Chaque utilisateur ne peut avoir qu'une seule connexion Tuya

## 📱 Contrôle des appareils

Les utilisateurs peuvent contrôler leurs appareils à partir de l'onglet "Appareils" :

- **Voir l'état** de chaque appareil
- **Activer/désactiver** les appareils (if supported)
- **Consulter les propriétés** (température, humidité, etc.)
- **Rafraîchir** la liste des appareils

## 🔌 Endpoints API

### Authentifiés (nécessitent un token de connexion)

- `GET /api/tuya/connection` - Obtenir les infos de connexion Tuya
- `POST /api/tuya/connect` - Connecter l'API Tuya
- `GET /api/tuya/devices` - Obtenir la liste des appareils
- `POST /api/tuya/device/control` - Contrôler un appareil
- `POST /api/tuya/disconnect` - Déconnecter Tuya

## 🐛 Dépannage

### "Identifiants Tuya invalides"
- Vérifiez que vos Client ID et Client Secret sont corrects
- Vérifiez que vous avez sélectionné la bonne région
- Assurez-vous que votre account Tuya dispose des permissions nécessaires

### "Aucun appareil trouvé"
- Assurez-vous que vous avez des appareils liés à votre compte Tuya
- Vérifiez la région sélectionnée
- Essayez de rafraîchir la liste

### Token expiré
- Le système essaie automatiquement de demander un nouveau token
- Si le problème persiste, déconnectez et reconnectez-vous

## 📝 Notes importantes

- Les appels API à Tuya peuvent prendre quelques secondes
- Le contrôle des appareils dépend de leur disponibilité et de leur support
- Les propriétés des appareils varient selon le modèle (thermostat, prise intelligente, ampoule, etc.)
