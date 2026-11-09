<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('run'));
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'score' => ['required', 'integer', 'min:0'],
        ];
    }
}
