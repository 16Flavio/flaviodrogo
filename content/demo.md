+++
title = "Démonstration"
description = "Deux modèles à essayer dans votre navigateur : l'un surveille une machine et signale les anomalies, l'autre lit un chiffre que vous écrivez à la main."
template = "demo.html"

[extra]
eyebrow = "Démonstration"
heading = "Deux modèles, à essayer tout de suite"
intro = "Les deux démonstrations tournent entièrement sur votre ordinateur : rien de ce que vous faites ici ne part sur Internet. Et rien n'est emprunté à une bibliothèque toute faite, tout ce qui apprend et décide dans cette page a été écrit pour elle."

monitor_eyebrow = "01 · Détection d'anomalies"
monitor_title = "Surveiller une machine qui n'est jamais tombée en panne"
monitor_body = "Une machine est équipée d'un capteur qui envoie une mesure en continu. Au chargement de la page, le modèle apprend à quoi ressemble une machine qui va bien : il s'entraîne à redessiner les quarante dernières mesures, et fixe tout seul la limite au-delà de laquelle il estime que quelque chose cloche. Provoquez une panne avec les boutons : il n'arrive plus à redessiner ce qu'il voit, l'écart grandit, et l'alerte tombe, parfois avant que le problème ne se voie à l'œil nu."
monitor_note = "Le modèle n'a jamais vu de panne : on ne lui a montré que des machines qui vont bien. C'est ce qui rend la méthode utilisable dans une usine, où les pannes sont rares, mal documentées, et rarement deux fois les mêmes."

digit_eyebrow = "02 · Reconnaissance de chiffres"
digit_title = "Dessinez un chiffre"
digit_body = "Tracez un chiffre de 0 à 9 dans le cadre. Votre dessin est réduit à une petite image de 28 pixels de côté, recadrée et recentrée exactement comme celles sur lesquelles le modèle a appris, puis on la lui montre. À droite : ce qu'il voit, ce qu'il répond, et à quel point il en est sûr."
digit_note = "Le modèle n'a jamais vu de tracé à la souris, seulement des chiffres écrits au stylo puis scannés. Un trait très fin, très épais ou collé au bord du cadre le met en difficulté, et c'est instructif : un modèle ne vaut que sur des données qui ressemblent à celles de son apprentissage."
+++
