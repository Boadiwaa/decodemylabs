require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoOcr'
  s.version        = package['version']
  s.summary        = 'On-device OCR using Apple Vision / Google ML Kit'
  s.description    = 'Expo module for text recognition on iOS (Vision) and Android (ML Kit)'
  s.homepage       = 'https://github.com/example/expo-ocr'
  s.license        = 'MIT'
  s.author         = 'Decode My Labs'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.swift_version  = '5.0'

  s.dependency 'ExpoModulesCore'
end
