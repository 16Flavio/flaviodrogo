+++
title = "Démonstration"
description = "Deux réseaux de neurones écrits à la main en JavaScript : l'un apprend une frontière de décision sous vos yeux, l'autre reconnaît un chiffre que vous dessinez."
template = "demo.html"

[extra]
eyebrow = "Démonstration"
heading = "Deux réseaux de neurones, écrits à la main"
intro = "Ces deux démonstrations tournent entièrement dans votre navigateur. Aucune donnée n'est envoyée nulle part, aucune librairie d'apprentissage n'est chargée : la propagation avant et la rétropropagation sont écrites à la main dans les deux fichiers JavaScript de cette page."

lab_eyebrow = "01 · Un réseau qui apprend"
lab_title = "Frontière de décision, en direct"
lab_body = "Choisissez un jeu de points, un optimiseur et une architecture, puis lancez l'entraînement. Le fond de la carte est la prédiction du réseau en chaque point du plan : il se déforme à chaque pas de descente de gradient. Vous pouvez aussi cliquer dans la carte pour ajouter vos propres points et voir le réseau s'y adapter."
lab_note = "Comparez Adam et la descente de gradient simple sur la spirale : c'est le genre d'écart qui, sur un vrai problème, sépare un modèle qui converge d'un modèle qu'on abandonne."

digit_eyebrow = "02 · Reconnaissance de chiffres"
digit_title = "Dessinez un chiffre"
digit_body = "Tracez un chiffre de 0 à 9 dans le cadre. Le tracé est recadré, redimensionné et recentré sur son centre de masse (exactement le prétraitement du jeu de données MNIST), puis présenté à un perceptron multicouche entraîné hors ligne. Les poids ont été quantifiés sur 8 bits pour tenir dans un fichier léger."
digit_note = "Le modèle n'a jamais vu de tracé à la souris, seulement des chiffres manuscrits numérisés. Un trait très fin, très épais ou collé au bord du cadre le met en difficulté : c'est instructif en soi."
+++
