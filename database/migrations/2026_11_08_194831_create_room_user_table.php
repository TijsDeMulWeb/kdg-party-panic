<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('character_id')->constrained();
            $table->unsignedTinyInteger('seat');
            $table->boolean('is_ready')->default(false);
            $table->timestamps();

            $table->unique(['room_id', 'user_id']);
            $table->unique(['room_id', 'seat']);
        });
    }
};
