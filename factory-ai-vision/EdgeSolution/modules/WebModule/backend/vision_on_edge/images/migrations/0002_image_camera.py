# Generated by Django 3.0.8 on 2020-09-01 08:33

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("cameras", "0002_camera_location"), ("images", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="image",
            name="camera",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="cameras.Camera",
            ),
        )
    ]
