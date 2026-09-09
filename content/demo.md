+++
title = "Démonstration"
description = "Deux réseaux de neurones écrits à la main en JavaScript : l'un surveille un capteur et signale les anomalies, l'autre reconnaît un chiffre que vous dessinez."
template = "demo.html"

[extra]
eyebrow = "Démonstration"
heading = "Deux réseaux de neurones, écrits à la main"
intro = "Ces deux démonstrations tournent entièrement dans votre navigateur. Aucune donnée n'est envoyée nulle part, aucune librairie d'apprentissage n'est chargée : la propagation avant et la rétropropagation sont écrites à la main dans les deux fichiers JavaScript de cette page."

monitor_eyebrow = "01 · Détection d'anomalies"
monitor_title = "Surveiller une machine qui n'est jamais tombée en panne"
monitor_body = "Un capteur de vibration envoie une mesure en continu. Au chargement de la page, un autoencodeur apprend à reconstruire une fenêtre de quarante mesures de fonctionnement normal, puis fixe seul son seuil d'alerte sur des fenêtres normales qu'il n'a jamais vues. En service, l'écart entre le signal réel et sa reconstruction fait office de score. Provoquez un incident avec les boutons : le score décroche dès que le signal quitte le régime appris, y compris quand la dérive est encore invisible à l'œil."
monitor_note = "Le modèle n'a jamais vu de panne : on ne lui a montré que du fonctionnement normal. C'est ce qui rend l'approche utilisable en industrie, où les défauts sont rares, presque jamais étiquetés, et rarement deux fois les mêmes."

digit_eyebrow = "02 · Reconnaissance de chiffres"
digit_title = "Dessinez un chiffre"
digit_body = "Tracez un chiffre de 0 à 9 dans le cadre. Le tracé est recadré, redimensionné et recentré sur son centre de masse (exactement le prétraitement du jeu de données MNIST), puis présenté à un perceptron multicouche entraîné hors ligne. Les poids ont été quantifiés sur 8 bits pour tenir dans un fichier léger."
digit_note = "Le modèle n'a jamais vu de tracé à la souris, seulement des chiffres manuscrits numérisés. Un trait très fin, très épais ou collé au bord du cadre le met en difficulté : c'est instructif en soi."
+++
