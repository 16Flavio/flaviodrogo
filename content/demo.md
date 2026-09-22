+++
title = "Démonstration"
description = "Deux modèles à essayer dans votre navigateur : l'un surveille une machine et signale les anomalies, l'autre lit un chiffre que vous écrivez à la main."
template = "demo.html"

[extra]
heading = "Deux démonstrations"
intro = "Deux outils à manipuler directement, du même genre que ceux que je livre. Rien n'est simulé : les modèles calculent en direct, à partir de ce que vous faites dans la page."

monitor_eyebrow = "Détection d'anomalies"
monitor_title = "Surveiller une machine qui n'est jamais tombée en panne"
monitor_body = "Une machine est équipée d'un capteur qui envoie une mesure en continu. Au chargement de la page, le modèle apprend à quoi ressemble le fonctionnement normal : il s'entraîne à redessiner les quarante dernières mesures, puis fixe lui-même la limite au-delà de laquelle l'écart devient suspect. Servez-vous des boutons pour provoquer une panne. Il n'arrive plus à redessiner ce qu'il voit, l'écart grandit, l'alerte tombe, souvent avant que la courbe ne paraisse anormale à l'œil."
monitor_note = "Le modèle n'a jamais vu de panne. On ne lui a montré que du fonctionnement normal, et c'est précisément ce qui rend la méthode utilisable en usine : les pannes y sont trop rares et trop variées pour qu'on puisse en dresser le catalogue."

digit_eyebrow = "Reconnaissance de chiffres"
digit_title = "Dessinez un chiffre"
digit_body = "Tracez un chiffre de 0 à 9 dans le cadre. Le dessin est réduit à une image de 28 pixels de côté, recadrée et recentrée comme l'étaient celles de l'apprentissage, puis présenté au modèle. La colonne de droite montre ce qu'il voit, ce qu'il répond, et la confiance qu'il accorde à chaque chiffre."
digit_note = "Le modèle n'a jamais vu de tracé à la souris. Il a appris sur des chiffres écrits au stylo puis scannés, et un trait trop fin ou collé au bord du cadre le met en difficulté. Un modèle ne vaut que sur des données qui ressemblent à celles de son apprentissage ; c'est une limite qu'on retrouve sur à peu près tous les projets."
+++
